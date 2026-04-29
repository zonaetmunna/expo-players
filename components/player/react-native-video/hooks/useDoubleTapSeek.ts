import { Gesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-worklets';

import type { RnvSnapshotRef } from './useRnvPlayerSnapshot';

type Options = {
  snapshot: RnvSnapshotRef;
  seek: (time: number) => void;
  layoutWidth: number;
  seekSeconds?: number;
  isLive: boolean;
  onSeek?: (direction: 'forward' | 'backward', seconds: number) => void;
};

export function useDoubleTapSeek({
  snapshot,
  seek,
  layoutWidth,
  seekSeconds = 10,
  isLive,
  onSeek,
}: Options) {
  const handle = (dir: 'forward' | 'backward') => {
    if (isLive) return;
    const snap = snapshot.current;
    if (!snap.isLoaded || !snap.duration) return;
    const delta = dir === 'forward' ? seekSeconds : -seekSeconds;
    const target = Math.max(0, Math.min(snap.duration, snap.currentTime + delta));
    seek(target);
    onSeek?.(dir, seekSeconds);
  };

  return Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(250)
    .onEnd((event) => {
      const isForward = event.x > layoutWidth / 2;
      runOnJS(handle)(isForward ? 'forward' : 'backward');
    });
}
