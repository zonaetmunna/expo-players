// Pure mapping helpers between our string-literal types and react-native-video
// v6's enum types. rn-video v6 expects enum values (not strings) on most props
// — string literals silently no-op for live prop updates on iOS.
//
// Kept together because they all serve the same purpose and have no React deps.
// Sibling helpers (drm.ts, ads.ts, errors.ts) follow the same single-file pattern.

import {
  ResizeMode as RnvResizeMode,
  type SelectedTrack,
  SelectedTrackType,
  type SelectedVideoTrack,
  SelectedVideoTrackType,
} from 'react-native-video';

import type { ResizeMode } from './resizeMode';

/** Map our string-literal ResizeMode to rn-video v6's ResizeMode enum.
 * rn-video v6 expects the enum values for live updates to take effect on iOS. */
export function mapResizeMode(mode: ResizeMode): RnvResizeMode {
  switch (mode) {
    case 'cover':
      return RnvResizeMode.COVER;
    case 'stretch':
      return RnvResizeMode.STRETCH;
    case 'none':
      return RnvResizeMode.NONE;
    case 'contain':
    default:
      return RnvResizeMode.CONTAIN;
  }
}

export function mapVideoTrackSelection(sel: number | 'auto'): SelectedVideoTrack {
  if (sel === 'auto') return { type: SelectedVideoTrackType.AUTO };
  return { type: SelectedVideoTrackType.INDEX, value: sel };
}

export function mapAudioTrackSelection(sel: number | null): SelectedTrack | undefined {
  if (sel === null) return undefined;
  return { type: SelectedTrackType.INDEX, value: sel };
}

export function mapTextTrackSelection(sel: number | null): SelectedTrack {
  if (sel === null) return { type: SelectedTrackType.DISABLED };
  return { type: SelectedTrackType.INDEX, value: sel };
}
