import { Gesture } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';

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

  const captureStart = () => {
    if (isLive) {
      startTime.value = -1;
      return;
    }
    const snap = snapshot.current;
    if (!snap.isLoaded || !snap.duration) {
      startTime.value = -1;
      return;
    }
    startTime.value = snap.currentTime;
  };

  const apply = (target: number) => {
    const snap = snapshot.current;
    if (!snap.isLoaded || !snap.duration) return;
    seek(Math.max(0, Math.min(snap.duration, target)));
  };

  const emit = (delta: number, target: number) => onUpdate?.({ delta, targetTime: target });
  const clear = () => onUpdate?.(null);

  return Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-20, 20])
    .onStart(() => {
      runOnJS(captureStart)();
    })
    .onUpdate((e) => {
      if (startTime.value < 0) return;
      const ratio = e.translationX / Math.max(1, layoutWidth);
      const delta = ratio * secondsPerScreen;
      runOnJS(emit)(delta, startTime.value + delta);
    })
    .onEnd((e) => {
      if (startTime.value < 0) {
        runOnJS(clear)();
        return;
      }
      const ratio = e.translationX / Math.max(1, layoutWidth);
      const delta = ratio * secondsPerScreen;
      runOnJS(apply)(startTime.value + delta);
      runOnJS(clear)();
    })
    .onFinalize(() => {
      runOnJS(clear)();
    });
}
