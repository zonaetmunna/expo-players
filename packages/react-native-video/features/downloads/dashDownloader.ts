// DASH download orchestrator. Mirrors hlsDownloader.ts exactly so the manager
// can dispatch on `kind` without caring about the protocol details.
//
// Flow:
//   1. Fetch the MPD
//   2. Parse → list of video Representations
//   3. Pick representation nearest target height (default 720)
//   4. Reject live (MPD@type="dynamic")
//   5. Download <Initialization> segment if present
//   6. Download all media segments concurrently with bounded parallelism
//   7. Rewrite the MPD so every segment URL becomes a relative local filename
//   8. Write the rewritten MPD to disk as index.mpd
//
// Cross-platform: only depends on global `fetch` + expo-file-system. No
// native modules, no platform branches.
//
// Out of scope (MVP, intentional):
//   - DRM offline (license persistence — paid SDK only)
//   - SegmentBase byte-range single-file representations
//   - Multi-AdaptationSet downloads (e.g. separate audio track download)
//   - Resumable downloads after app kill (partial writes are GC'd by the
//     fact that the MPD itself isn't written until all segments finish)

import * as FileSystem from 'expo-file-system/legacy';

import {
  type DashRepresentation,
  parseMpd,
  pickRepresentationNear,
  pickSmallestAudio,
} from './dashParser';
import { ensureDiskSpace, estimateBytesFromBitrate } from './diskSpace';
import { withRetry } from './retry';

/** Progress reporter — fires roughly per-segment-completed. */
export type DashProgressCallback = (info: {
  /** 0..1 — completed segments / total. */
  progress: number;
  /** Bytes written so far across init + all segments. */
  writtenBytes: number;
  /** Best-known total (sum of completed × estimated avg). */
  estimatedTotalBytes: number;
}) => void;

/** Cancellation signal — caller flips .cancelled = true to abort. */
export type DashCancelToken = { cancelled: boolean };

export type DashDownloadResult = {
  /** Path to the rewritten MPD (the file rn-video should play). */
  localManifestPath: string;
  /** All segment local paths (for cleanup on delete). */
  segmentPaths: string[];
  /** Optional init segment local path. */
  initPath?: string;
  /** Total bytes saved. */
  totalBytes: number;
  /** Total media duration in seconds. */
  durationSec: number;
  /** Representation we picked (informational). */
  representation: DashRepresentation;
};

const SEGMENT_CONCURRENCY = 4;

async function fetchText(url: string, cancel?: DashCancelToken): Promise<string> {
  return withRetry(
    async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
      return res.text();
    },
    { isCancelled: cancel ? () => cancel.cancelled : undefined }
  );
}

/** Bounded-concurrency mapper. Same shape as in hlsDownloader for consistency. */
async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
  cancel: DashCancelToken
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

/** Download a single segment with retry on transient failures.
 *  Returns size on disk. 4xx fails fast; 5xx + network errors retry. */
async function downloadOne(
  remoteUri: string,
  localPath: string,
  cancel: DashCancelToken
): Promise<number> {
  return withRetry(
    async () => {
      const result = await FileSystem.downloadAsync(remoteUri, localPath);
      if (result.status >= 400) {
        throw new Error(`HTTP ${result.status} downloading ${remoteUri}`);
      }
      const info = await FileSystem.getInfoAsync(result.uri);
      return info.exists && 'size' in info ? (info.size ?? 0) : 0;
    },
    { isCancelled: () => cancel.cancelled }
  );
}

/** Build a safe local filename from a segment URL. */
function segFileName(segUri: string, index: number): string {
  const noQuery = segUri.split('?')[0];
  const baseName = noQuery.substring(noQuery.lastIndexOf('/') + 1) || `seg-${index}.m4s`;
  const idx = String(index).padStart(5, '0');
  return `${idx}-${baseName}`;
}

/**
 * Main entry point. Downloads a DASH source to `targetDir` and writes a
 * rewritten manifest that points at local files.
 */
export async function downloadDash({
  sourceUri,
  targetDir,
  onProgress,
  cancel,
  targetHeight = 720,
}: {
  sourceUri: string;
  targetDir: string;
  onProgress?: DashProgressCallback;
  cancel: DashCancelToken;
  targetHeight?: number;
}): Promise<DashDownloadResult> {
  // Ensure per-video directory exists.
  const dirInfo = await FileSystem.getInfoAsync(targetDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(targetDir, { intermediates: true });
  }

  // 1. Fetch + parse the MPD.
  const mpdText = await fetchText(sourceUri, cancel);
  if (cancel.cancelled) throw new Error('cancelled');

  const manifest = parseMpd(mpdText, sourceUri);
  if (!manifest.isVod) {
    throw new Error('Live DASH streams cannot be downloaded');
  }
  if (manifest.videoRepresentations.length === 0) {
    throw new Error('MPD contained no playable video representations');
  }

  // 2. Pick video + (optional) audio representations.
  const videoRep = pickRepresentationNear(manifest.videoRepresentations, targetHeight);
  if (videoRep.segments.length === 0) {
    throw new Error('Picked video representation had no segments');
  }
  const audioRep = pickSmallestAudio(manifest.audioRepresentations);
  // Note: when audioRep is undefined, audio is either muxed into the video
  // segments (typical for older DASH) or absent entirely (silent video).
  // Both cases just work — we only download what's there.

  // Refined disk-space check including audio bandwidth if present.
  const estimatedBytes = estimateBytesFromBitrate(
    videoRep.bandwidth + (audioRep?.bandwidth ?? 0),
    manifest.totalDurationSec
  );
  await ensureDiskSpace(estimatedBytes);

  // Two layouts depending on whether there's separate audio:
  //
  //   No audio rep (muxed in video segs):
  //     <targetDir>/
  //       index.mpd
  //       init.mp4
  //       seg-*.m4s
  //
  //   Separate audio rep:
  //     <targetDir>/
  //       index.mpd
  //       video/init.mp4
  //       video/seg-*.m4s
  //       audio/init.mp4
  //       audio/seg-*.m4s
  const hasSeparateAudio = !!audioRep;
  const videoDir = hasSeparateAudio ? `${targetDir}/video` : targetDir;
  if (hasSeparateAudio) {
    await FileSystem.makeDirectoryAsync(videoDir, { intermediates: true });
  }

  // Track aggregate progress across video + audio so the user-visible bar is
  // one number. Weight by segment count (close enough proxy for byte share).
  const totalSegmentCount = videoRep.segments.length + (audioRep?.segments.length ?? 0);
  let completedTotal = 0;
  let writtenTotal = 0;

  // Download VIDEO rep first (it's the bigger fetch, and progress feels right
  // when the visible video bytes start landing immediately).
  const videoResult = await downloadOneRep({
    rep: videoRep,
    targetDir: videoDir,
    cancel,
    onSegmentDone: (size) => {
      writtenTotal += size;
      completedTotal += 1;
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

  // Download AUDIO rep if present.
  let audioResult: Awaited<ReturnType<typeof downloadOneRep>> | undefined;
  if (audioRep) {
    const audioDir = `${targetDir}/audio`;
    await FileSystem.makeDirectoryAsync(audioDir, { intermediates: true });
    audioResult = await downloadOneRep({
      rep: audioRep,
      targetDir: audioDir,
      cancel,
      onSegmentDone: (size) => {
        writtenTotal += size;
        completedTotal += 1;
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

  // 3. Rewrite the MPD. Same approach for both single- and dual-set layouts:
  //    surgically replace each chosen Representation's contents with a
  //    SegmentList that references local files (relative to the MPD location).
  //    For dual-set the relative paths include the video/ or audio/ subfolder.
  let rewritten = mpdText;

  // Strip ALL existing BaseURL tags so they don't override our local layout.
  rewritten = rewritten.replace(/<BaseURL[^>]*>[\s\S]*?<\/BaseURL>/g, '');

  // Replace the chosen video Representation's body with a local SegmentList.
  rewritten = inlineLocalSegmentList(rewritten, videoRep.id, {
    initLocalName: videoResult.initLocalName,
    pathPrefix: hasSeparateAudio ? 'video/' : '',
    segmentPlans: videoResult.segmentPlans.map((p) => ({
      name: p.name,
      durationSec: p.durationSec,
    })),
  });

  // Same for audio if present.
  if (audioRep && audioResult) {
    rewritten = inlineLocalSegmentList(rewritten, audioRep.id, {
      initLocalName: audioResult.initLocalName,
      pathPrefix: 'audio/',
      segmentPlans: audioResult.segmentPlans.map((p) => ({
        name: p.name,
        durationSec: p.durationSec,
      })),
    });
  }

  // Drop OTHER representations from each AdaptationSet — we only downloaded
  // the chosen ones, and leaving the rest in would make the player try to
  // ABR-switch to a remote URL during offline playback.
  const keepIds = new Set<string>([videoRep.id]);
  if (audioRep) keepIds.add(audioRep.id);
  rewritten = stripRepresentationsExcept(rewritten, keepIds);

  // Drop entire AdaptationSets that have no kept Representations left.
  // ExoPlayer's DashMediaPeriod.buildPrimaryAndEmbeddedTrackGroupInfos
  // throws IllegalArgumentException when it sees an empty TrackGroup, which
  // happens when subtitle/thumbnail/trick-play AdaptationSets are left as
  // empty shells after we keep only the chosen video + audio Reps.
  rewritten = stripEmptyAdaptationSets(rewritten);

  // Strip AdaptationSet-level SegmentTemplate / SegmentList — our chosen
  // Representations now have inlined SegmentLists, so inheritance would only
  // create conflicts.
  rewritten = stripAdaptationSetSegmentDefs(rewritten, keepIds);

  const localManifestPath = `${targetDir}/index.mpd`;
  await FileSystem.writeAsStringAsync(localManifestPath, rewritten);

  // Aggregate paths/bytes for the result.
  const allSegmentPaths = [
    ...videoResult.segmentPlans.map((p) => p.path),
    ...(audioResult?.segmentPlans.map((p) => p.path) ?? []),
  ];
  const totalBytes = videoResult.totalBytes + (audioResult?.totalBytes ?? 0);

  return {
    localManifestPath,
    segmentPaths: allSegmentPaths,
    initPath: videoResult.initPath,
    totalBytes,
    durationSec:
      manifest.totalDurationSec || videoRep.segments.reduce((s, x) => s + x.durationSec, 0),
    representation: videoRep,
  };
}

/**
 * Download one representation (init + all segments) into targetDir. Returns
 * the local plan + bytes — caller wires up progress + does the MPD rewrite.
 */
async function downloadOneRep(args: {
  rep: DashRepresentation;
  targetDir: string;
  cancel: DashCancelToken;
  onSegmentDone?: (size: number) => void;
}): Promise<{
  initPath?: string;
  initLocalName?: string;
  segmentPlans: { name: string; path: string; durationSec: number }[];
  totalBytes: number;
}> {
  const { rep, targetDir, cancel, onSegmentDone } = args;

  let totalBytes = 0;
  let initPath: string | undefined;
  let initLocalName: string | undefined;
  if (rep.initSegmentUri) {
    initLocalName = 'init.mp4';
    initPath = `${targetDir}/${initLocalName}`;
    totalBytes += await downloadOne(rep.initSegmentUri, initPath, cancel);
  }
  if (cancel.cancelled) throw new Error('cancelled');

  const segmentPlans = rep.segments.map((seg, i) => ({
    name: segFileName(seg.uri, i),
    path: `${targetDir}/${segFileName(seg.uri, i)}`,
    durationSec: seg.durationSec,
    remoteUri: seg.uri,
  }));

  await mapWithConcurrency(
    segmentPlans,
    SEGMENT_CONCURRENCY,
    async (plan) => {
      if (cancel.cancelled) return 0;
      const size = await downloadOne(plan.remoteUri, plan.path, cancel);
      totalBytes += size;
      onSegmentDone?.(size);
      return size;
    },
    cancel
  );

  return {
    initPath,
    initLocalName,
    segmentPlans: segmentPlans.map(({ name, path, durationSec }) => ({ name, path, durationSec })),
    totalBytes,
  };
}

// ─── MPD rewrite helpers ────────────────────────────────────────────────────

/**
 * Build a <SegmentList> that points at local files using paths relative to
 * the MPD location. `pathPrefix` is "" when files sit alongside the MPD,
 * "video/" when they're in a subfolder, etc.
 */
function buildLocalSegmentList(args: {
  initLocalName: string | undefined;
  pathPrefix: string;
  segmentPlans: { name: string; durationSec: number }[];
}): string {
  const { initLocalName, pathPrefix, segmentPlans } = args;
  // timescale=1000 + duration in ms gives ~ms precision for VOD seeking.
  const timescale = 1000;
  // Use the longest segment as the nominal duration. Player will still seek
  // correctly because each <SegmentURL> is enumerated explicitly.
  const nominalDurMs = Math.max(
    1,
    Math.round(Math.max(...segmentPlans.map((s) => s.durationSec || 0)) * timescale)
  );
  const initLine = initLocalName
    ? `    <Initialization sourceURL="${pathPrefix}${initLocalName}"/>\n`
    : '';
  const segLines = segmentPlans
    .map((s) => `    <SegmentURL media="${pathPrefix}${s.name}"/>`)
    .join('\n');
  return `\n  <SegmentList timescale="${timescale}" duration="${nominalDurMs}">\n${initLine}${segLines}\n  </SegmentList>\n`;
}

/**
 * Find the Representation with `repId` in the MPD and replace its inner XML
 * with a fresh local SegmentList. Idempotent — leaves the rest of the MPD
 * structure (AdaptationSet, Period, root MPD) intact.
 */
function inlineLocalSegmentList(
  xml: string,
  repId: string,
  args: {
    initLocalName: string | undefined;
    pathPrefix: string;
    segmentPlans: { name: string; durationSec: number }[];
  }
): string {
  const repIdEsc = repId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Match BOTH forms — DASH MPDs use both depending on whether the Rep has
  // child elements (self-closed dominates in SegmentTemplate-based MPDs):
  //   <Representation id="..." ... />                      ← self-closing
  //   <Representation id="..." ...>...</Representation>    ← with body
  // Capture group 1 = open-tag attributes, group 2 = inner XML (empty for self-closed).
  const re = new RegExp(
    `<Representation\\b([^>]*?\\sid=["']${repIdEsc}["'][^>]*?)(?:/>|>([\\s\\S]*?)</Representation>)`
  );
  const localList = buildLocalSegmentList(args);
  return xml.replace(re, (_full, openAttrs, originalInner = '') => {
    // Preserve any non-segment child elements the Rep had — AudioChannelConfiguration,
    // ContentProtection, Label, InbandEventStream, etc. These can carry decoder
    // setup info ExoPlayer needs. Strip ONLY the segment-defining children
    // since we're replacing them with our local SegmentList.
    const preservedInner = originalInner
      .replace(/<SegmentTemplate\b[^>]*?(?:\/>|>[\s\S]*?<\/SegmentTemplate>)/g, '')
      .replace(/<SegmentList\b[^>]*?(?:\/>|>[\s\S]*?<\/SegmentList>)/g, '')
      .replace(/<SegmentBase\b[^>]*?(?:\/>|>[\s\S]*?<\/SegmentBase>)/g, '')
      .replace(/<BaseURL\b[^>]*>[\s\S]*?<\/BaseURL>/g, '');
    // Strip trailing '/' from open attrs in case the source was self-closed.
    const cleanedAttrs = openAttrs.replace(/\s*\/\s*$/, '');
    return `<Representation${cleanedAttrs}>${preservedInner}${localList}</Representation>`;
  });
}

/**
 * Remove entire <AdaptationSet> blocks that contain no <Representation>
 * children. Run this AFTER stripRepresentationsExcept — once the unchosen
 * Reps are gone, any AdaptationSet without survivors is dead weight, and
 * ExoPlayer's DashMediaPeriod throws IllegalArgumentException when it tries
 * to build a TrackGroup from zero formats.
 *
 * Typical victims: subtitle AdaptationSets, trick-play / thumbnail
 * AdaptationSets, and any audio AdaptationSet other than the one we picked.
 */
function stripEmptyAdaptationSets(xml: string): string {
  return xml.replace(/<AdaptationSet\b[^>]*>([\s\S]*?)<\/AdaptationSet>/g, (full, inner) => {
    // Has at least one surviving Representation? Keep.
    if (/<Representation\b/.test(inner)) return full;
    return '';
  });
}

/** Remove every <Representation> whose id is NOT in the keep set.
 *  Matches BOTH self-closing `<Representation ... />` and the explicit-body
 *  `<Representation ...>...</Representation>` forms — DASH MPDs use both
 *  depending on whether the Rep has child elements (self-closed is dominant
 *  for SegmentTemplate-based MPDs since the Rep itself has no children). */
function stripRepresentationsExcept(xml: string, keepIds: Set<string>): string {
  return xml.replace(
    /<Representation\b([^>]*?)(?:\/>|>([\s\S]*?)<\/Representation>)/g,
    (full, openAttrs) => {
      const idMatch = openAttrs.match(/\sid=["']([^"']+)["']/);
      const id = idMatch?.[1] ?? '';
      return keepIds.has(id) ? full : '';
    }
  );
}

/**
 * Strip AdaptationSet-level <SegmentTemplate> and <SegmentList> tags. We
 * inlined a fresh SegmentList into each kept Representation, so any
 * AdaptationSet-level definitions would conflict via inheritance.
 *
 * We keep Segment* defs that live INSIDE one of our kept Representations
 * (those are the ones we just wrote — leaving them alone is correct).
 */
function stripAdaptationSetSegmentDefs(xml: string, keepIds: Set<string>): string {
  return xml.replace(
    /<(SegmentTemplate|SegmentList)\b[^>]*?(?:\/>|>[\s\S]*?<\/\1>)/g,
    (match, _tag, offset) => (isInsideKeptRepresentation(xml, offset, keepIds) ? match : '')
  );
}

/** True if the substring starting at `offset` lives inside one of the kept Representations. */
function isInsideKeptRepresentation(xml: string, offset: number, keepIds: Set<string>): boolean {
  const before = xml.substring(0, offset);
  const lastOpen = before.lastIndexOf('<Representation');
  if (lastOpen === -1) return false;
  const lastClose = before.lastIndexOf('</Representation>');
  if (lastClose > lastOpen) return false;
  const openTagEnd = before.indexOf('>', lastOpen);
  const openTag = before.substring(lastOpen, openTagEnd + 1);
  const idMatch = openTag.match(/\sid=["']([^"']+)["']/);
  return idMatch ? keepIds.has(idMatch[1]) : false;
}
