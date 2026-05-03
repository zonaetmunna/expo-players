// HLS download orchestrator. Coordinates: fetch master → pick variant → fetch
// variant playlist → download all segments + key concurrently → save to disk.
//
// Cross-platform: only depends on global `fetch` + expo-file-system. No
// native modules, no platform branches. Same code on iOS + Android.
//
// Out of scope (MVP):
//   - DRM offline (license persistence)
//   - Byte-range segments
//   - Live (we reject non-VOD playlists)
//   - Resumable downloads after app kill (tracked-but-not-finished segments
//     get re-downloaded; the manifest itself isn't written until all segments
//     finish, so a partial download leaves no local m3u8 to play from)

import * as FileSystem from 'expo-file-system/legacy';

import { ensureDiskSpace, estimateBytesFromBitrate } from './diskSpace';
import {
  type HlsMaster,
  type HlsMedia,
  type HlsSegment,
  type HlsVariant,
  isMasterPlaylist,
  parseMaster,
  parseVariant,
  pickAudioRendition,
  pickVariantNear,
} from './hlsParser';
import { withRetry } from './retry';

/** Progress reporter — fires roughly per-segment-completed. */
export type HlsProgressCallback = (info: {
  /** 0..1 — segments completed / total. */
  progress: number;
  /** Bytes written so far across all segments. */
  writtenBytes: number;
  /** Best-known total (sum of completed segment sizes × estimated). */
  estimatedTotalBytes: number;
}) => void;

/** Cancellation signal — caller flips .cancelled = true to abort the download. */
export type HlsCancelToken = { cancelled: boolean };

export type HlsDownloadResult = {
  /** Path to the rewritten variant playlist (the file rn-video should play). */
  localPlaylistPath: string;
  /** All segment local paths (for cleanup on delete). */
  segmentPaths: string[];
  /** Optional local key path. */
  keyPath?: string;
  /** Total bytes saved. */
  totalBytes: number;
  /** Total media duration in seconds (sum of segment durations). */
  durationSec: number;
  /** Variant we picked (informational — used for logs and registry metadata). */
  variant: HlsVariant;
  /** Raw rewritten variant playlist text (caller writes it via the rewriter). */
  rewrittenPlaylist?: string;
};

const SEGMENT_CONCURRENCY = 4;

/** Fetch text with retry on transient failures. Used for master + variant
 *  playlist fetches — small files but the same network conditions that kill
 *  segments will kill these too. */
async function fetchText(url: string, cancel?: HlsCancelToken): Promise<string> {
  return withRetry(
    async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
      return res.text();
    },
    { isCancelled: cancel ? () => cancel.cancelled : undefined }
  );
}

/** Run an array of async tasks with bounded concurrency. */
async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
  cancel: HlsCancelToken
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const runWorker = async (): Promise<void> => {
    while (true) {
      if (cancel.cancelled) return;
      const i = nextIndex++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker());
  await Promise.all(workers);
  return results;
}

/** Download a single segment to localPath. Returns size in bytes.
 *  Wrapped in withRetry — transient 5xx / network errors are retried with
 *  exponential backoff. 4xx (e.g. 404) fails fast. */
async function downloadSegment(
  remoteUri: string,
  localPath: string,
  cancel: HlsCancelToken
): Promise<number> {
  return withRetry(
    async () => {
      const result = await FileSystem.downloadAsync(remoteUri, localPath);
      if (result.status >= 400) {
        throw new Error(`HTTP ${result.status} downloading segment ${remoteUri}`);
      }
      // getInfoAsync gives us the size on disk.
      const info = await FileSystem.getInfoAsync(result.uri);
      return info.exists && 'size' in info ? (info.size ?? 0) : 0;
    },
    { isCancelled: () => cancel.cancelled }
  );
}

/** Sanitize a segment URL into a safe local filename. */
function segmentFileName(seg: HlsSegment, index: number): string {
  // Strip query string + grab the last path segment.
  const noQuery = seg.uri.split('?')[0];
  const baseName = noQuery.substring(noQuery.lastIndexOf('/') + 1) || `seg-${index}.ts`;
  // Pad index so files sort naturally + collisions impossible.
  const idx = String(index).padStart(5, '0');
  return `${idx}-${baseName}`;
}

/**
 * Main entry point. Downloads an HLS source to `targetDir` and returns the
 * info needed to rewrite the playlist for local playback.
 *
 * Flow:
 *   1. Ensure targetDir exists
 *   2. Fetch master playlist (or treat input as variant if no STREAM-INF tags)
 *   3. Pick variant nearest target height (default 720p)
 *   4. Fetch variant playlist
 *   5. Reject non-VOD (live can't be downloaded)
 *   6. Download AES key if present
 *   7. Download all segments with bounded concurrency, reporting progress
 *   8. Return paths so the rewriter can produce the local m3u8
 */
export async function downloadHls({
  sourceUri,
  targetDir,
  onProgress,
  cancel,
  targetHeight = 720,
}: {
  sourceUri: string;
  targetDir: string;
  onProgress?: HlsProgressCallback;
  cancel: HlsCancelToken;
  targetHeight?: number;
}): Promise<HlsDownloadResult> {
  // Ensure the per-video directory exists.
  const dirInfo = await FileSystem.getInfoAsync(targetDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(targetDir, { intermediates: true });
  }

  // 1. Fetch the URL the consumer gave us. Could be master OR a media playlist.
  const rootText = await fetchText(sourceUri, cancel);
  if (cancel.cancelled) throw new Error('cancelled');

  // 2. Pick a variant. If there are no STREAM-INF lines, treat the input as
  //    the only variant (some HLS streams skip the master and serve the
  //    media playlist directly).
  let variant: HlsVariant;
  let variantText: string;
  let master: HlsMaster | undefined;
  let audio: HlsMedia | undefined;
  if (isMasterPlaylist(rootText)) {
    master = parseMaster(rootText, sourceUri);
    if (master.variants.length === 0) {
      throw new Error('Master playlist contained no variants');
    }
    variant = pickVariantNear(master.variants, targetHeight);
    variantText = await fetchText(variant.uri, cancel);
    if (cancel.cancelled) throw new Error('cancelled');
    // Pick a separate audio rendition if the variant's audio group has one
    // with an explicit URI. (When audio is muxed into the variant segments,
    // pickAudioRendition returns undefined and we just download video.)
    audio = pickAudioRendition(master, variant);
  } else {
    // Single-rendition stream — the input URI IS the variant.
    variant = { uri: sourceUri, bandwidth: 0 };
    variantText = rootText;
  }

  // 3. Parse video segments + key.
  const playlist = parseVariant(variantText, variant.uri);
  if (!playlist.isVod) {
    throw new Error('Live HLS streams cannot be downloaded');
  }
  if (playlist.segments.length === 0) {
    throw new Error('Variant playlist had no segments');
  }

  // Refined disk-space check now that we know the variant bandwidth + total
  // duration. Throws DiskSpaceError if the estimate wouldn't leave headroom.
  const estimatedBytes = estimateBytesFromBitrate(variant.bandwidth, playlist.totalDurationSec);
  await ensureDiskSpace(estimatedBytes);

  // Two layouts depending on whether there's a separate audio rendition:
  //
  //   No audio rendition (muxed or single-stream):
  //     <targetDir>/
  //       index.m3u8        ← rewritten variant playlist
  //       seg-*.ts          ← video+audio muxed segments
  //       key.bin           ← optional
  //
  //   Separate audio rendition:
  //     <targetDir>/
  //       index.m3u8        ← rewritten MASTER (refs video + audio playlists)
  //       video/index.m3u8  ← rewritten video playlist
  //       video/seg-*.ts    ← video segments
  //       video/key.bin     ← optional
  //       audio/index.m3u8  ← rewritten audio playlist
  //       audio/seg-*.aac   ← audio segments
  //       audio/key.bin     ← optional (separate AES key on audio)
  //
  // This matches what shaka/hls.js produce for offline.
  const hasSeparateAudio = !!audio;
  const videoDir = hasSeparateAudio ? `${targetDir}/video` : targetDir;
  if (hasSeparateAudio) {
    await FileSystem.makeDirectoryAsync(videoDir, { intermediates: true });
  }

  // Track aggregate progress across video + audio so the user-visible bar
  // is one number. Roughly proportional: total = video segs + audio segs.
  let completedTotal = 0;
  let writtenTotal = 0;
  let totalSegmentCount = playlist.segments.length;

  // Fetch audio playlist first (we need its segment count to weight progress
  // correctly). Cheap — it's just a text file.
  let audioText: string | undefined;
  let audioPlaylist: ReturnType<typeof parseVariant> | undefined;
  if (audio?.uri) {
    audioText = await fetchText(audio.uri, cancel);
    audioPlaylist = parseVariant(audioText, audio.uri);
    if (!audioPlaylist.isVod) {
      throw new Error('Live HLS audio rendition cannot be downloaded');
    }
    totalSegmentCount += audioPlaylist.segments.length;
  }

  // Download VIDEO playlist (key + segments + write rewritten m3u8).
  const videoResult = await downloadOneRendition({
    playlistText: variantText,
    parsed: playlist,
    targetDir: videoDir,
    cancel,
    onProgressOne: (segs, bytes) => {
      writtenTotal += bytes;
      completedTotal += segs;
      onProgress?.({
        progress: completedTotal / totalSegmentCount,
        writtenBytes: writtenTotal,
        estimatedTotalBytes:
          completedTotal > 0
            ? Math.round((writtenTotal / completedTotal) * totalSegmentCount)
            : writtenTotal,
      });
    },
  });

  // Download AUDIO playlist if there's a separate one.
  let audioResult: { rewritten: string; segmentPaths: string[]; keyPath?: string; totalBytes: number } | undefined;
  if (audio?.uri && audioPlaylist && audioText) {
    const audioDir = `${targetDir}/audio`;
    await FileSystem.makeDirectoryAsync(audioDir, { intermediates: true });
    audioResult = await downloadOneRendition({
      playlistText: audioText,
      parsed: audioPlaylist,
      targetDir: audioDir,
      cancel,
      onProgressOne: (segs, bytes) => {
        writtenTotal += bytes;
        completedTotal += segs;
        onProgress?.({
          progress: completedTotal / totalSegmentCount,
          writtenBytes: writtenTotal,
          estimatedTotalBytes:
            completedTotal > 0
              ? Math.round((writtenTotal / completedTotal) * totalSegmentCount)
              : writtenTotal,
        });
      },
    });
  }

  if (cancel.cancelled) throw new Error('cancelled');

  // Write the top-level index.m3u8.
  //   - If there's a separate audio rendition: write a small master that
  //     references video/index.m3u8 + audio/index.m3u8.
  //   - Otherwise: the video playlist IS the top-level index.
  const localPlaylistPath = `${targetDir}/index.m3u8`;
  if (hasSeparateAudio && audio) {
    const masterText = buildLocalMasterPlaylist({
      variant,
      audio,
      audioCodec: extractAudioCodec(variant.codecs),
    });
    await FileSystem.writeAsStringAsync(localPlaylistPath, masterText);
    // Also write the rewritten video playlist into video/index.m3u8.
    await FileSystem.writeAsStringAsync(`${videoDir}/index.m3u8`, videoResult.rewritten);
  } else {
    await FileSystem.writeAsStringAsync(localPlaylistPath, videoResult.rewritten);
  }

  const totalBytes = videoResult.totalBytes + (audioResult?.totalBytes ?? 0);

  return {
    localPlaylistPath,
    segmentPaths: [
      ...videoResult.segmentPaths,
      ...(audioResult?.segmentPaths ?? []),
    ],
    keyPath: videoResult.keyPath,
    totalBytes,
    durationSec: playlist.totalDurationSec,
    variant,
    rewrittenPlaylist: videoResult.rewritten,
  };
}

/**
 * Download a single HLS rendition (video OR audio): key + all segments,
 * then build the rewritten playlist text pointing at the local filenames.
 * Doesn't write the playlist file itself — caller decides where it lives.
 */
async function downloadOneRendition(args: {
  playlistText: string;
  parsed: ReturnType<typeof parseVariant>;
  targetDir: string;
  cancel: HlsCancelToken;
  /** Called once per segment with (1, sizeBytes). Lets the caller aggregate
   *  progress across multiple renditions into a single user-visible bar. */
  onProgressOne?: (segmentsCompleted: number, bytesAdded: number) => void;
}): Promise<{ rewritten: string; segmentPaths: string[]; keyPath?: string; totalBytes: number }> {
  const { playlistText, parsed, targetDir, cancel, onProgressOne } = args;

  // Key download (if any).
  let keyPath: string | undefined;
  let keyLocalUri: string | undefined;
  if (parsed.key) {
    const keyName = 'key.bin';
    keyPath = `${targetDir}/${keyName}`;
    keyLocalUri = keyName;
    const keyUri = parsed.key.uri;
    const keyDestPath = keyPath;
    await withRetry(
      async () => {
        const keyResult = await FileSystem.downloadAsync(keyUri, keyDestPath);
        if (keyResult.status >= 400) {
          throw new Error(`HTTP ${keyResult.status} downloading key`);
        }
      },
      { isCancelled: () => cancel.cancelled }
    );
  }
  if (cancel.cancelled) throw new Error('cancelled');

  // Plan segment paths.
  const segmentPlans = parsed.segments.map((seg, i) => ({
    seg,
    name: segmentFileName(seg, i),
    path: `${targetDir}/${segmentFileName(seg, i)}`,
  }));

  let totalBytes = 0;
  await mapWithConcurrency(
    segmentPlans,
    SEGMENT_CONCURRENCY,
    async (plan) => {
      if (cancel.cancelled) return 0;
      const size = await downloadSegment(plan.seg.uri, plan.path, cancel);
      totalBytes += size;
      onProgressOne?.(1, size);
      return size;
    },
    cancel
  );

  // Rewrite playlist text to point at local filenames.
  // Critical: use the segment's RAW URI (the literal string as it appeared in
  // the playlist), not the resolved absolute URL. Many CDNs (Mux, JW, Akamai,
  // Apple BipBop) emit relative URIs that resolve to a different absolute —
  // replacing the absolute would silently no-op and the saved playlist would
  // still reference the remote URI as a relative path → ENOENT at playback.
  let rewritten = playlistText;
  for (const plan of segmentPlans) {
    rewritten = rewritten.replace(plan.seg.rawUri, plan.name);
  }
  if (parsed.key && keyLocalUri) {
    rewritten = rewritten.replace(parsed.key.rawUri, keyLocalUri);
  }

  return {
    rewritten,
    segmentPaths: segmentPlans.map((p) => p.path),
    keyPath,
    totalBytes,
  };
}

/**
 * Build a tiny master playlist that references the locally-downloaded video +
 * audio playlists. We strip everything we don't need from the original master
 * (other variants, other audio renditions) so the player has exactly one
 * choice and can't try to ABR-switch to a remote URL during offline playback.
 */
function buildLocalMasterPlaylist(args: {
  variant: HlsVariant;
  audio: HlsMedia;
  audioCodec?: string;
}): string {
  const { variant, audio, audioCodec } = args;
  const lines: string[] = ['#EXTM3U', '#EXT-X-VERSION:6'];
  // Audio rendition declaration.
  const audioAttrs: string[] = [
    'TYPE=AUDIO',
    `GROUP-ID="${audio.groupId || 'aud1'}"`,
    `NAME="${(audio.name || 'audio').replace(/"/g, "'")}"`,
  ];
  if (audio.language) audioAttrs.push(`LANGUAGE="${audio.language}"`);
  audioAttrs.push('DEFAULT=YES', 'AUTOSELECT=YES', 'URI="audio/index.m3u8"');
  lines.push(`#EXT-X-MEDIA:${audioAttrs.join(',')}`);
  // Variant entry.
  const streamAttrs: string[] = [`BANDWIDTH=${variant.bandwidth || 1000000}`];
  if (variant.resolution) streamAttrs.push(`RESOLUTION=${variant.resolution}`);
  // Reuse the original variant codecs verbatim — the codec string includes both
  // video and audio entries when audio is in a separate group, so the player
  // can decoder-init both.
  if (variant.codecs) streamAttrs.push(`CODECS="${variant.codecs}"`);
  else if (audioCodec) streamAttrs.push(`CODECS="${audioCodec}"`);
  streamAttrs.push(`AUDIO="${audio.groupId || 'aud1'}"`);
  lines.push(`#EXT-X-STREAM-INF:${streamAttrs.join(',')}`);
  lines.push('video/index.m3u8');
  return `${lines.join('\n')}\n`;
}

/** Pull just the audio codec from a comma-separated CODECS string. */
function extractAudioCodec(codecs: string | undefined): string | undefined {
  if (!codecs) return undefined;
  const audioPart = codecs.split(',').map((c) => c.trim()).find((c) => c.startsWith('mp4a') || c.startsWith('ec-3') || c.startsWith('ac-3'));
  return audioPart;
}
