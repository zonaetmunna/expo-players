// Determines what kind of download (if any) is possible for a video source.
// MP4/WebM/Ogg → single-file download. HLS → segmented downloader (clear AES
// or unencrypted only — no DRM). DASH → segmented downloader (no DRM, VOD only).
// DRM and live can never be saved offline via the free path.

import type { VideoItem } from '../../types/types';

export function isDownloadable(source: Pick<VideoItem, 'type' | 'isLive' | 'drm'>): boolean {
  if (source.isLive) return false;
  if (source.drm) return false;
  // mp4, webm, ogg → single-file download via expo-file-system.
  // hls  → segmented download via hlsDownloader  (only non-DRM HLS).
  // dash → segmented download via dashDownloader (only non-DRM VOD MPDs).
  return true;
}

/**
 * Distinguishes which download path to use. Caller dispatches on this so the
 * manager doesn't need to re-check source.type internally.
 */
export type DownloadKind = 'file' | 'hls' | 'dash';

export function downloadKind(source: Pick<VideoItem, 'type'>): DownloadKind {
  if (source.type === 'hls') return 'hls';
  if (source.type === 'dash') return 'dash';
  return 'file';
}
