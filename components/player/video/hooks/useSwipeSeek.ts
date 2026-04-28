import type { VideoPlayer } from 'expo-video';
import { Gesture } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { runOnJS } from 'react-native-worklets';

import type { PlayerSnapshotRef } from './usePlayerSnapshot';

type Options = {
  player: VideoPlayer;
  snapshot: PlayerSnapshotRef;
  layoutWidth: number;
  secondsPerScreen?: number;
  onUpdate?: (preview: { delta: number; targetTime: number } | null) => void;
};

export function useSwipeSeek({
  player,
  snapshot,
  layoutWidth,
  secondsPerScreen = 90,
  onUpdate,
}: Options) {
  const startTime = useSharedValue(0);

  const captureStart = () => {
    const snap = snapshot.current;
    if (snap.status !== 'readyToPlay' || snap.isLive) {
      startTime.value = -1; // sentinel: disabled
      return;
    }
    startTime.value = snap.currentTime;
  };

  const apply = (target: number) => {
    const snap = snapshot.current;
    if (snap.status !== 'readyToPlay' || snap.isLive || !snap.duration) return;
    const clamped = Math.max(0, Math.min(snap.duration, target));
    try {
      player.currentTime = clamped;
    } catch {
      // ignore
    }
  };

  const emitPreview = (delta: number, target: number) => {
    onUpdate?.({ delta, targetTime: target });
  };

  const clearPreview = () => onUpdate?.(null);

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
      const target = startTime.value + delta;
      runOnJS(emitPreview)(delta, target);
    })
    .onEnd((e) => {
      if (startTime.value < 0) {
        runOnJS(clearPreview)();
        return;
      }
      const ratio = e.translationX / Math.max(1, layoutWidth);
      const delta = ratio * secondsPerScreen;
      const target = startTime.value + delta;
      runOnJS(apply)(target);
      runOnJS(clearPreview)();
    })
    .onFinalize(() => {
      runOnJS(clearPreview)();
    });
}
