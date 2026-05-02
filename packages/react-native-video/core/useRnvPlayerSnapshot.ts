import { useRef } from 'react';

import type { RnvSnapshot } from '../types/types';

export type RnvSnapshotRef = { current: RnvSnapshot };

export function useRnvPlayerSnapshot(): RnvSnapshotRef {
  return useRef<RnvSnapshot>({
    currentTime: 0,
    duration: 0,
    volume: 1,
    buffering: false,
    isLoaded: false,
    isPlaying: false,
    videoTracks: [],
    selectedVideoTrack: 'auto',
    audioTracks: [],
    selectedAudioTrack: null,
    textTracks: [],
    selectedTextTrack: null,
  });
}
