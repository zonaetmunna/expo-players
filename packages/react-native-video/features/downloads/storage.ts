// Storage layer for downloaded videos. Owns:
//   - paths (per-video file for MP4, per-video directory for HLS/DASH)
//   - registry index in AsyncStorage (which IDs are downloaded + metadata)
//
// Layout under documentDirectory/rnv-downloads/:
//   - MP4:  <id>.mp4                                     (single file)
//   - HLS:  <id>/index.m3u8 + segments + key.bin         (directory)
//   - DASH: <id>/index.mpd  + init.mp4 + .m4s segments   (directory)
//
// Files live in the app's private documents directory — sandboxed, not
// visible in the device gallery, deleted on app uninstall. Matches the
// YouTube/Netflix offline-download pattern.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

import type { SideLoadedSubtitle } from '../../types/types';

/** Per-download record kept in AsyncStorage. */
export type DownloadRecord = {
  id: string;
  /** Original remote URL the file was downloaded from. */
  remoteUri: string;
  /** Local URI to play — for MP4 it's the .mp4 file, for HLS it's the local index.m3u8. */
  localUri: string;
  /** Whether the download is a single file or a directory tree (HLS/DASH). Drives delete logic. */
  kind: 'file' | 'hls' | 'dash';
  /** Bytes on disk. */
  sizeBytes: number;
  /** Wall-clock timestamp of when the download finished. */
  downloadedAt: number;
  /** Optional metadata snapshotted at download time so the downloads list
   *  has something to render even if the source is later removed from the catalog. */
  title?: string;
  poster?: string;
  durationSec?: number;
  /** Locally-cached sidecar subtitles. Each `uri` points at a file:// path.
   *  Empty/undefined when the source had no subtitles or download failed. */
  subtitles?: SideLoadedSubtitle[];
};

const REGISTRY_KEY = '@rnv/downloads/registry';
const DOWNLOADS_DIR = `${FileSystem.documentDirectory ?? ''}rnv-downloads/`;

/** Single-file path used by MP4-style downloads. */
export function localPathFor(videoId: string): string {
  return `${DOWNLOADS_DIR}${videoId}.mp4`;
}

/** Per-video directory used by HLS downloads (segments + index.m3u8 + key live here). */
export function hlsDirFor(videoId: string): string {
  return `${DOWNLOADS_DIR}${videoId}`;
}

/** Per-video directory used by DASH downloads (segments + index.mpd + init.mp4 live here). */
export function dashDirFor(videoId: string): string {
  return `${DOWNLOADS_DIR}${videoId}`;
}

/** Path of the rewritten local m3u8 inside the HLS dir. The HLS downloader
 *  always writes its rewritten playlist as `index.m3u8`. */
export function hlsPlaylistPathFor(videoId: string): string {
  return `${hlsDirFor(videoId)}/index.m3u8`;
}

/** Path of the rewritten local MPD inside the DASH dir. */
export function dashManifestPathFor(videoId: string): string {
  return `${dashDirFor(videoId)}/index.mpd`;
}

/** Per-video directory used to hold downloaded sidecar subtitle files.
 *  Separate from the video dir so MP4 (single-file) downloads can also have
 *  subtitles without forcing a directory layout for the video itself. */
export function subtitleDirFor(videoId: string): string {
  return `${DOWNLOADS_DIR}${videoId}-subs`;
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

/** Remove the record AND the on-disk content. Idempotent.
 *  For MP4: delete the single file. For HLS/DASH: delete the entire directory
 *  (which removes the manifest, all segments, init/key files in one shot). */
export async function deleteRecord(videoId: string): Promise<void> {
  const registry = await readRegistry();
  const record = registry[videoId];
  delete registry[videoId];
  await writeRegistry(registry);
  if (record) {
    try {
      const target =
        record.kind === 'hls'
          ? hlsDirFor(videoId)
          : record.kind === 'dash'
            ? dashDirFor(videoId)
            : record.localUri;
      await FileSystem.deleteAsync(target, { idempotent: true });
    } catch {
      // ignore — already gone
    }
    // Always try to clean the subtitle dir too — exists only when subtitles
    // were downloaded, idempotent: true makes the no-such-dir case a no-op.
    try {
      await FileSystem.deleteAsync(subtitleDirFor(videoId), { idempotent: true });
    } catch {
      // ignore
    }
  }
}

/** Total bytes used by all downloaded videos. */
export async function totalDiskUsage(): Promise<number> {
  const registry = await readRegistry();
  return Object.values(registry).reduce((sum, r) => sum + (r.sizeBytes || 0), 0);
}
