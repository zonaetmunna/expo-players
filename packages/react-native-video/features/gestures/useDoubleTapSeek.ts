import { useMemo, useRef } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';

import type { RnvSnapshotRef } from '../../core/useRnvPlayerSnapshot';

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
  // Latest-options ref so the memoized gesture closure always sees fresh callbacks
  // without forcing the gesture to be rebuilt every render.
  const optsRef = useRef({ snapshot, seek, seekSeconds, isLive, onSeek });
  optsRef.current = { snapshot, seek, seekSeconds, isLive, onSeek };

  return useMemo(() => {
    const handle = (dir: 'forward' | 'backward') => {
      const o = optsRef.current;
      if (o.isLive) return;
      const snap = o.snapshot.current;
      if (!snap.isLoaded || !snap.duration) return;
      const delta = dir === 'forward' ? o.seekSeconds : -o.seekSeconds;
      const target = Math.max(0, Math.min(snap.duration, snap.currentTime + delta));
      o.seek(target);
      o.onSeek?.(dir, o.seekSeconds);
    };

    return Gesture.Tap()
      .numberOfTaps(2)
      .maxDuration(250)
      .onEnd((event) => {
        const isForward = event.x > layoutWidth / 2;
        scheduleOnRN(handle, isForward ? 'forward' : 'backward');
      });
  }, [layoutWidth]);
}
