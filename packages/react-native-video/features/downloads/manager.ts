// Download manager for video files. Owns the in-flight download tasks +
// a pubsub for hook subscribers. Thin layer over expo-file-system's
// createDownloadResumable, plus the storage layer below.
//
// Public surface:
//   - downloadVideo(input)   → start (or no-op if already done/in-flight)
//   - cancelDownload(id)     → cancel an in-flight task
//   - deleteDownload(id)     → remove file + registry entry
//   - getStatus(id)          → synchronous current state
//   - subscribe(id, fn)      → notify on status change for one id
//   - subscribeAll(fn)       → notify on any status change
//
// React-friendly hooks live in ./useDownloads.ts and just wrap these.

import * as FileSystem from 'expo-file-system/legacy';

import type { SideLoadedSubtitle } from '../../types/types';
import { type DashCancelToken, downloadDash } from './dashDownloader';
import { ensureDiskSpace } from './diskSpace';
import { downloadHls, type HlsCancelToken } from './hlsDownloader';
import {
  type DownloadRecord,
  dashDirFor,
  deleteRecord,
  ensureDownloadsDir,
  getRecord,
  hlsDirFor,
  localPathFor,
  subtitleDirFor,
  upsertRecord,
} from './storage';
import { downloadSubtitles, type LocalSubtitle } from './subtitleDownloader';

export type DownloadState = 'idle' | 'downloading' | 'done' | 'error' | 'cancelled';

export type DownloadStatus = {
  id: string;
  state: DownloadState;
  /** 0..1 during download; undefined when idle/done/error. */
  progress?: number;
  /** Bytes written so far (matches progress when known). */
  writtenBytes?: number;
  /** Total bytes if Content-Length was reported, else undefined. */
  totalBytes?: number;
  /** Local file URI when state === 'done'. */
  localUri?: string;
  /** Locally-cached sidecar subtitles when state === 'done'. Each `uri` points
   *  at a file:// path so subtitles play offline. Empty when the source had
   *  none or download failed (player can fall back to source.subtitles). */
  subtitles?: LocalSubtitle[];
  /** Last error message when state === 'error'. */
  error?: string;
};

/** Minimal shape consumers pass in — VideoItem-compatible but decoupled. */
export type DownloadInput = {
  id: string;
  uri: string;
  /** Selects the downloader. Defaults to 'file' (single-file MP4/WebM/Ogg).
   *  Pass 'hls' for .m3u8 sources or 'dash' for .mpd sources — both use a
   *  segmented downloader that fetches all media chunks + the manifest, then
   *  rewrites the manifest to point at local files. */
  kind?: 'file' | 'hls' | 'dash';
  title?: string;
  poster?: string;
  durationSec?: number;
  /** Sidecar subtitles to download alongside the video. Each entry's `uri`
   *  is fetched and rewritten to a local file:// path in the resulting
   *  DownloadStatus + DownloadRecord. Failures are skipped, not fatal. */
  subtitles?: SideLoadedSubtitle[];
};

type Subscriber = (status: DownloadStatus) => void;

const inFlight = new Map<string, FileSystem.DownloadResumable>();
/** HLS uses a custom cancel token instead of expo-file-system's DownloadResumable. */
const inFlightHls = new Map<string, HlsCancelToken>();
/** DASH uses the same cancel-token pattern as HLS (per-segment loop checks the flag). */
const inFlightDash = new Map<string, DashCancelToken>();
const statusCache = new Map<string, DownloadStatus>();
const perIdSubs = new Map<string, Set<Subscriber>>();
const allSubs = new Set<Subscriber>();

function emit(status: DownloadStatus): void {
  statusCache.set(status.id, status);
  perIdSubs.get(status.id)?.forEach((fn) => {
    fn(status);
  });
  allSubs.forEach((fn) => {
    fn(status);
  });
}

/** Synchronous read of current status. Returns 'idle' if nothing is known. */
export function getStatus(id: string): DownloadStatus {
  return statusCache.get(id) ?? { id, state: 'idle' };
}

/**
 * Helper used by all three download paths after the main media has finished.
 * Downloads any sidecar subtitles into a per-id directory, returning the
 * rewritten LocalSubtitle entries (empty when there were none or all failed).
 *
 * Subtitle failures are non-fatal — we'd rather ship the video offline with
 * no subtitles than fail the whole download because one .vtt 404'd.
 */
async function fetchSidecarSubtitles(
  input: DownloadInput,
  isCancelled: () => boolean
): Promise<LocalSubtitle[]> {
  if (!input.subtitles || input.subtitles.length === 0) return [];
  return downloadSubtitles({
    subtitles: input.subtitles,
    targetDir: subtitleDirFor(input.id),
    isCancelled,
  });
}

/** Subscribe to status changes for a single id. Returns an unsubscribe fn. */
export function subscribe(id: string, fn: Subscriber): () => void {
  let set = perIdSubs.get(id);
  if (!set) {
    set = new Set();
    perIdSubs.set(id, set);
  }
  set.add(fn);
  return () => {
    set?.delete(fn);
    if (set && set.size === 0) perIdSubs.delete(id);
  };
}

/** Subscribe to ALL status changes (used by the downloads-list hook). */
export function subscribeAll(fn: Subscriber): () => void {
  allSubs.add(fn);
  return () => {
    allSubs.delete(fn);
  };
}

/**
 * Hydrate the in-memory status cache from the on-disk registry. Call once on
 * app boot (or just lazily — the first useDownloadStatus call triggers it).
 * Idempotent.
 */
let hydrated = false;
let hydratePromise: Promise<void> | null = null;
export async function hydrate(): Promise<void> {
  if (hydrated) return;
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    const { readRegistry } = await import('./storage');
    const registry = await readRegistry();
    for (const record of Object.values(registry)) {
      statusCache.set(record.id, {
        id: record.id,
        state: 'done',
        localUri: record.localUri,
        totalBytes: record.sizeBytes,
        writtenBytes: record.sizeBytes,
        progress: 1,
        subtitles: record.subtitles,
      });
    }
    hydrated = true;
  })();
  return hydratePromise;
}

/**
 * Start downloading a video. No-op if it's already done or currently
 * downloading. Returns the final status (resolved when download completes).
 */
export async function downloadVideo(input: DownloadInput): Promise<DownloadStatus> {
  await hydrate();

  // Already done — just return the cached status.
  const existing = statusCache.get(input.id);
  if (existing?.state === 'done') return existing;

  // Already downloading — wait for the existing task by subscribing.
  if (existing?.state === 'downloading' && inFlight.has(input.id)) {
    return new Promise((resolve) => {
      const unsub = subscribe(input.id, (s) => {
        if (s.state === 'done' || s.state === 'error' || s.state === 'cancelled') {
          unsub();
          resolve(s);
        }
      });
    });
  }

  await ensureDownloadsDir();

  // Pre-flight disk-space guard. Refuses to start if free space is below the
  // safety floor — better to surface a clear error now than to crash mid-write.
  // Estimate is unknown at this point (we'd need the manifest first); this
  // catches the "device almost full" case. The downloader can refine the
  // check after parsing the manifest if it wants.
  try {
    await ensureDiskSpace(0);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const errorStatus: DownloadStatus = { id: input.id, state: 'error', error: message };
    emit(errorStatus);
    return errorStatus;
  }

  // Dispatch by kind. Default 'file' preserves backward compat for callers
  // that don't pass kind (the existing MP4 path).
  if (input.kind === 'hls') {
    return runHlsDownload(input);
  }
  if (input.kind === 'dash') {
    return runDashDownload(input);
  }

  const localUri = localPathFor(input.id);

  emit({ id: input.id, state: 'downloading', progress: 0 });

  const task = FileSystem.createDownloadResumable(input.uri, localUri, {}, (data) => {
    const total = data.totalBytesExpectedToWrite;
    const written = data.totalBytesWritten;
    emit({
      id: input.id,
      state: 'downloading',
      progress: total > 0 ? written / total : undefined,
      writtenBytes: written,
      totalBytes: total > 0 ? total : undefined,
    });
  });
  inFlight.set(input.id, task);

  try {
    const result = await task.downloadAsync();
    inFlight.delete(input.id);

    // result is undefined when cancelled mid-flight.
    if (!result) {
      emit({ id: input.id, state: 'cancelled' });
      return getStatus(input.id);
    }

    const info = await FileSystem.getInfoAsync(result.uri);
    const sizeBytes = info.exists && 'size' in info ? (info.size ?? 0) : 0;

    // Sidecar subtitles after the main file is on disk. MP4 has no cancel
    // token mid-flight (expo-file-system aborts atomically), so we just check
    // once before starting the subtitle phase.
    const localSubtitles = await fetchSidecarSubtitles(input, () => false);

    const record: DownloadRecord = {
      id: input.id,
      remoteUri: input.uri,
      localUri: result.uri,
      kind: 'file',
      sizeBytes,
      downloadedAt: Date.now(),
      title: input.title,
      poster: input.poster,
      durationSec: input.durationSec,
      subtitles: localSubtitles.length > 0 ? localSubtitles : undefined,
    };
    await upsertRecord(record);

    const finalStatus: DownloadStatus = {
      id: input.id,
      state: 'done',
      progress: 1,
      writtenBytes: sizeBytes,
      totalBytes: sizeBytes,
      localUri: result.uri,
      subtitles: localSubtitles.length > 0 ? localSubtitles : undefined,
    };
    emit(finalStatus);
    return finalStatus;
  } catch (e) {
    inFlight.delete(input.id);
    const message = e instanceof Error ? e.message : String(e);
    const errorStatus: DownloadStatus = { id: input.id, state: 'error', error: message };
    emit(errorStatus);
    return errorStatus;
  }
}

/**
 * HLS-specific download path. Same outward shape as the MP4 path (emits the
 * same DownloadStatus events, registers a cancel token, writes a registry
 * record at the end), but internally fans out to the segmented downloader.
 *
 * The local index.m3u8 produced by hlsDownloader becomes the record's localUri
 * — rn-video plays this file:// URL identically to a remote .m3u8.
 */
async function runHlsDownload(input: DownloadInput): Promise<DownloadStatus> {
  const cancel: HlsCancelToken = { cancelled: false };
  inFlightHls.set(input.id, cancel);

  emit({ id: input.id, state: 'downloading', progress: 0 });

  try {
    const result = await downloadHls({
      sourceUri: input.uri,
      targetDir: hlsDirFor(input.id),
      cancel,
      onProgress: ({ progress, writtenBytes, estimatedTotalBytes }) => {
        emit({
          id: input.id,
          state: 'downloading',
          progress,
          writtenBytes,
          totalBytes: estimatedTotalBytes,
        });
      },
    });

    inFlightHls.delete(input.id);

    if (cancel.cancelled) {
      emit({ id: input.id, state: 'cancelled' });
      return getStatus(input.id);
    }

    // Sidecar subtitles after the main playlist+segments are on disk. The
    // cancel token is still in scope from runHlsDownload's closure.
    const localSubtitles = await fetchSidecarSubtitles(input, () => cancel.cancelled);

    const record: DownloadRecord = {
      id: input.id,
      remoteUri: input.uri,
      localUri: result.localPlaylistPath,
      kind: 'hls',
      sizeBytes: result.totalBytes,
      downloadedAt: Date.now(),
      title: input.title,
      poster: input.poster,
      // Prefer the parsed playlist duration (always accurate) over the input's
      // optional metadata (which may be stale or absent for HLS sources).
      durationSec: result.durationSec || input.durationSec,
      subtitles: localSubtitles.length > 0 ? localSubtitles : undefined,
    };
    await upsertRecord(record);

    const finalStatus: DownloadStatus = {
      id: input.id,
      state: 'done',
      progress: 1,
      writtenBytes: result.totalBytes,
      totalBytes: result.totalBytes,
      localUri: result.localPlaylistPath,
      subtitles: localSubtitles.length > 0 ? localSubtitles : undefined,
    };
    emit(finalStatus);
    return finalStatus;
  } catch (e) {
    inFlightHls.delete(input.id);
    const message = e instanceof Error ? e.message : String(e);
    // Distinguish cancellation (thrown as 'cancelled' by the downloader) from real errors.
    if (message === 'cancelled') {
      const cancelled: DownloadStatus = { id: input.id, state: 'cancelled' };
      emit(cancelled);
      return cancelled;
    }
    const errorStatus: DownloadStatus = { id: input.id, state: 'error', error: message };
    emit(errorStatus);
    return errorStatus;
  }
}

/**
 * DASH-specific download path. Same outward shape as the HLS path (emits the
 * same DownloadStatus events, registers a cancel token, writes a registry
 * record at the end), but internally fans out to the DASH downloader.
 *
 * The local index.mpd produced by dashDownloader becomes the record's
 * localUri — rn-video plays this file:// URL identically to a remote .mpd.
 */
async function runDashDownload(input: DownloadInput): Promise<DownloadStatus> {
  const cancel: DashCancelToken = { cancelled: false };
  inFlightDash.set(input.id, cancel);

  emit({ id: input.id, state: 'downloading', progress: 0 });

  try {
    const result = await downloadDash({
      sourceUri: input.uri,
      targetDir: dashDirFor(input.id),
      cancel,
      onProgress: ({ progress, writtenBytes, estimatedTotalBytes }) => {
        emit({
          id: input.id,
          state: 'downloading',
          progress,
          writtenBytes,
          totalBytes: estimatedTotalBytes,
        });
      },
    });

    inFlightDash.delete(input.id);

    if (cancel.cancelled) {
      emit({ id: input.id, state: 'cancelled' });
      return getStatus(input.id);
    }

    // Sidecar subtitles after the main manifest+segments are on disk.
    const localSubtitles = await fetchSidecarSubtitles(input, () => cancel.cancelled);

    const record: DownloadRecord = {
      id: input.id,
      remoteUri: input.uri,
      localUri: result.localManifestPath,
      kind: 'dash',
      sizeBytes: result.totalBytes,
      downloadedAt: Date.now(),
      title: input.title,
      poster: input.poster,
      // Prefer the parsed manifest duration over the input metadata (always
      // accurate and avoids drift from stale catalog values).
      durationSec: result.durationSec || input.durationSec,
      subtitles: localSubtitles.length > 0 ? localSubtitles : undefined,
    };
    await upsertRecord(record);

    const finalStatus: DownloadStatus = {
      id: input.id,
      state: 'done',
      progress: 1,
      writtenBytes: result.totalBytes,
      totalBytes: result.totalBytes,
      localUri: result.localManifestPath,
      subtitles: localSubtitles.length > 0 ? localSubtitles : undefined,
    };
    emit(finalStatus);
    return finalStatus;
  } catch (e) {
    inFlightDash.delete(input.id);
    const message = e instanceof Error ? e.message : String(e);
    if (message === 'cancelled') {
      const cancelled: DownloadStatus = { id: input.id, state: 'cancelled' };
      emit(cancelled);
      return cancelled;
    }
    const errorStatus: DownloadStatus = { id: input.id, state: 'error', error: message };
    emit(errorStatus);
    return errorStatus;
  }
}

/** Cancel an in-flight download. No-op if nothing is in-flight for this id.
 *  Handles MP4 (expo-file-system DownloadResumable), HLS, and DASH (cancel tokens). */
export async function cancelDownload(id: string): Promise<void> {
  // HLS path: flip the cancel token. The in-flight loop checks it between
  // segments and throws 'cancelled' which is caught in runHlsDownload.
  const hlsToken = inFlightHls.get(id);
  if (hlsToken) {
    hlsToken.cancelled = true;
    inFlightHls.delete(id);
    emit({ id, state: 'cancelled' });
    return;
  }
  // DASH path: same cancel-token pattern as HLS.
  const dashToken = inFlightDash.get(id);
  if (dashToken) {
    dashToken.cancelled = true;
    inFlightDash.delete(id);
    emit({ id, state: 'cancelled' });
    return;
  }
  // MP4 path: ask expo-file-system to abort the resumable.
  const task = inFlight.get(id);
  if (!task) return;
  try {
    await task.cancelAsync();
  } catch {
    // ignore
  }
  inFlight.delete(id);
  emit({ id, state: 'cancelled' });
}

/** Remove a downloaded file and its registry entry. */
export async function deleteDownload(id: string): Promise<void> {
  await deleteRecord(id);
  statusCache.delete(id);
  emit({ id, state: 'idle' });
}

/** Get the local file URI for a downloaded video, or null if not downloaded. */
export async function getLocalUri(id: string): Promise<string | null> {
  await hydrate();
  const cached = statusCache.get(id);
  if (cached?.state === 'done' && cached.localUri) return cached.localUri;
  const record = await getRecord(id);
  return record?.localUri ?? null;
}
