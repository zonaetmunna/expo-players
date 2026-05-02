// Storage layer for downloaded videos. Owns:
//   - file paths (documentDirectory/rnv-downloads/<id>.mp4)
//   - registry index in AsyncStorage (which IDs are downloaded + metadata)
//
// Files live in the app's private documents directory — sandboxed, not
// visible in the device gallery, deleted on app uninstall. This matches the
// YouTube/Netflix offline-download pattern.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

/** Per-download record kept in AsyncStorage. */
export type DownloadRecord = {
  id: string;
  /** Original remote URL the file was downloaded from. */
  remoteUri: string;
  /** Local file:// path on this device. */
  localUri: string;
  /** Bytes on disk. */
  sizeBytes: number;
  /** Wall-clock timestamp of when the download finished. */
  downloadedAt: number;
  /** Optional metadata snapshotted at download time so the downloads list
   *  has something to render even if the source is later removed from the catalog. */
  title?: string;
  poster?: string;
  durationSec?: number;
};

const REGISTRY_KEY = '@rnv/downloads/registry';
const DOWNLOADS_DIR = `${FileSystem.documentDirectory ?? ''}rnv-downloads/`;

/** Local file path for a given video id. Extension is hard-coded mp4 for now
 *  (Round 1 supports MP4 only — HLS/DASH downloads need a different scheme). */
export function localPathFor(videoId: string): string {
  return `${DOWNLOADS_DIR}${videoId}.mp4`;
}

/** Ensure the downloads directory exists. Cheap to call repeatedly. */
export async function ensureDownloadsDir(): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(DOWNLOADS_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(DOWNLOADS_DIR, { intermediates: true });
    }
  } catch {
    // ignore — caller will hit the error on the next file op anyway
  }
}

/** Read the full registry — { [id]: record }. Returns {} on first run / parse error. */
export async function readRegistry(): Promise<Record<string, DownloadRecord>> {
  try {
    const raw = await AsyncStorage.getItem(REGISTRY_KEY);
    return raw == null ? {} : (JSON.parse(raw) as Record<string, DownloadRecord>);
  } catch {
    return {};
  }
}

/** Write the registry (whole object replace). */
async function writeRegistry(registry: Record<string, DownloadRecord>): Promise<void> {
  try {
    await AsyncStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
  } catch {
    // ignore — best-effort persistence
  }
}

/** Look up a single record. */
export async function getRecord(videoId: string): Promise<DownloadRecord | null> {
  const registry = await readRegistry();
  return registry[videoId] ?? null;
}

/** Insert or replace a record. */
export async function upsertRecord(record: DownloadRecord): Promise<void> {
  const registry = await readRegistry();
  registry[record.id] = record;
  await writeRegistry(registry);
}

/** Remove the record AND the file. Idempotent. */
export async function deleteRecord(videoId: string): Promise<void> {
  const registry = await readRegistry();
  const record = registry[videoId];
  delete registry[videoId];
  await writeRegistry(registry);
  if (record) {
    try {
      await FileSystem.deleteAsync(record.localUri, { idempotent: true });
    } catch {
      // ignore — file may already be gone
    }
  }
}

/** Total bytes used by all downloaded videos. */
export async function totalDiskUsage(): Promise<number> {
  const registry = await readRegistry();
  return Object.values(registry).reduce((sum, r) => sum + (r.sizeBytes || 0), 0);
}
