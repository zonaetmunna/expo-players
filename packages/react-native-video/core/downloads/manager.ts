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

import {
  type DownloadRecord,
  deleteRecord,
  ensureDownloadsDir,
  getRecord,
  localPathFor,
  upsertRecord,
} from './storage';

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
  /** Last error message when state === 'error'. */
  error?: string;
};

/** Minimal shape consumers pass in — VideoItem-compatible but decoupled. */
export type DownloadInput = {
  id: string;
  uri: string;
  title?: string;
  poster?: string;
  durationSec?: number;
};

type Subscriber = (status: DownloadStatus) => void;

const inFlight = new Map<string, FileSystem.DownloadResumable>();
const statusCache = new Map<string, DownloadStatus>();
const perIdSubs = new Map<string, Set<Subscriber>>();
const allSubs = new Set<Subscriber>();

function emit(status: DownloadStatus): void {
  statusCache.set(status.id, status);
  perIdSubs.get(status.id)?.forEach((fn) => fn(status));
  allSubs.forEach((fn) => fn(status));
}

/** Synchronous read of current status. Returns 'idle' if nothing is known. */
export function getStatus(id: string): DownloadStatus {
  return statusCache.get(id) ?? { id, state: 'idle' };
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
  const localUri = localPathFor(input.id);

  emit({ id: input.id, state: 'downloading', progress: 0 });

  const task = FileSystem.createDownloadResumable(
    input.uri,
    localUri,
    {},
    (data) => {
      const total = data.totalBytesExpectedToWrite;
      const written = data.totalBytesWritten;
      emit({
        id: input.id,
        state: 'downloading',
        progress: total > 0 ? written / total : undefined,
        writtenBytes: written,
        totalBytes: total > 0 ? total : undefined,
      });
    }
  );
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

    const record: DownloadRecord = {
      id: input.id,
      remoteUri: input.uri,
      localUri: result.uri,
      sizeBytes,
      downloadedAt: Date.now(),
      title: input.title,
      poster: input.poster,
      durationSec: input.durationSec,
    };
    await upsertRecord(record);

    const finalStatus: DownloadStatus = {
      id: input.id,
      state: 'done',
      progress: 1,
      writtenBytes: sizeBytes,
      totalBytes: sizeBytes,
      localUri: result.uri,
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

/** Cancel an in-flight download. No-op if nothing is in-flight for this id. */
export async function cancelDownload(id: string): Promise<void> {
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
