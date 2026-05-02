// Round 1 supports MP4 progressive downloads only. HLS / DASH are
// segmented (manifest + many .ts/.m4s files) — downloading the manifest URL
// alone gets a tiny text file, not the video. DRM streams require license
// persistence the free download path doesn't provide. Live streams have no
// finite size to download.
//
// Consumers should hide their Download button when this returns false.

import type { VideoItem } from '../../types/types';

export function isDownloadable(source: Pick<VideoItem, 'type' | 'isLive' | 'drm'>): boolean {
  if (source.isLive) return false;
  if (source.drm) return false;
  // mp4, webm, ogg are all single-file containers — fine to download.
  // hls, dash are segmented — not supported in Round 1.
  if (source.type === 'hls' || source.type === 'dash') return false;
  return true;
}
