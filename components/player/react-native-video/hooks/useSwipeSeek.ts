import { useMemo, useRef } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { RnvSnapshotRef } from './useRnvPlayerSnapshot';

type Options = {
  snapshot: RnvSnapshotRef;
  seek: (time: number) => void;
  layoutWidth: number;
  isLive: boolean;
  secondsPerScreen?: number;
  onUpdate?: (preview: { delta: number; targetTime: number } | null) => void;
};

export function useSwipeSeek({
  snapshot,
  seek,
  layoutWidth,
  isLive,
  secondsPerScreen = 90,
  onUpdate,
}: Options) {
  const startTime = useSharedValue(0);
  const optsRef = useRef({ snapshot, seek, isLive, secondsPerScreen, onUpdate });
  optsRef.current = { snapshot, seek, isLive, secondsPerScreen, onUpdate };

  return useMemo(() => {
    const captureStart = () => {
      const o = optsRef.current;
      if (o.isLive) {
        startTime.value = -1;
        return;
      }
      const snap = o.snapshot.current;
      if (!snap.isLoaded || !snap.duration) {
        startTime.value = -1;
        return;
      }
      startTime.value = snap.currentTime;
    };

    const apply = (target: number) => {
      const o = optsRef.current;
      const snap = o.snapshot.current;
      if (!snap.isLoaded || !snap.duration) return;
      o.seek(Math.max(0, Math.min(snap.duration, target)));
    };

    const emit = (delta: number, target: number) =>
      optsRef.current.onUpdate?.({ delta, targetTime: target });
    const clear = () => optsRef.current.onUpdate?.(null);

    // Capture as closure constants — worklets cannot reliably read mutable JS refs.
    const sps = secondsPerScreen;
    const lw = layoutWidth;

    return Gesture.Pan()
      .activeOffsetX([-12, 12])
      .failOffsetY([-20, 20])
      .onStart(() => {
        scheduleOnRN(captureStart);
      })
      .onUpdate((e) => {
        if (startTime.value < 0) return;
        const ratio = e.translationX / Math.max(1, lw);
        const delta = ratio * sps;
        scheduleOnRN(emit, delta, startTime.value + delta);
      })
      .onEnd((e) => {
        if (startTime.value < 0) {
          scheduleOnRN(clear);
          return;
        }
        const ratio = e.translationX / Math.max(1, lw);
        const delta = ratio * sps;
        scheduleOnRN(apply, startTime.value + delta);
        scheduleOnRN(clear);
      })
      .onFinalize(() => {
        scheduleOnRN(clear);
      });
  }, [layoutWidth, secondsPerScreen, startTime]);
}
