// Determines what kind of download (if any) is possible for a video source.
// MP4/WebM/Ogg → single-file download. HLS/DASH → segmented downloader.
// DRM streams need offline license persistence the free path doesn't provide.
// Live streams have no finite end.

import type { VideoItem } from '../../types/types';

/** What kind of downloader to use for this source. */
export type DownloadableKind = 'mp4' | 'hls' | 'dash';

/** Why a source can't be downloaded — surfaced to UI for honest tooltips. */
export type NotDownloadableReason = 'drm' | 'live' | 'unsupported';

export type DownloadCapability =
  | { downloadable: true; kind: DownloadableKind }
  | { downloadable: false; reason: NotDownloadableReason };

export function getDownloadCapability(
  source: Pick<VideoItem, 'type' | 'isLive' | 'drm'>
): DownloadCapability {
  if (source.isLive) return { downloadable: false, reason: 'live' };
  if (source.drm) return { downloadable: false, reason: 'drm' };
  if (source.type === 'mp4' || source.type === 'webm' || source.type === 'ogg') {
    return { downloadable: true, kind: 'mp4' };
  }
  if (source.type === 'hls') return { downloadable: true, kind: 'hls' };
  if (source.type === 'dash') return { downloadable: true, kind: 'dash' };
  return { downloadable: false, reason: 'unsupported' };
}

/** Backwards-compat boolean helper. Prefer getDownloadCapability for richer UX. */
export function isDownloadable(source: Pick<VideoItem, 'type' | 'isLive' | 'drm'>): boolean {
  return getDownloadCapability(source).downloadable;
}
