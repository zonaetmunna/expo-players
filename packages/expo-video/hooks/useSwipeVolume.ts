import type { VideoPlayer } from 'expo-video';
import { Dimensions, Platform } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { runOnJS } from 'react-native-worklets';

import type { PlayerSnapshotRef } from './usePlayerSnapshot';

type Options = {
  player: VideoPlayer;
  snapshot: PlayerSnapshotRef;
  layoutWidth: number;
  layoutHeight: number;
  onUpdate?: (volume: number | null) => void;
};

export function useSwipeVolume({ player, snapshot, layoutWidth, layoutHeight, onUpdate }: Options) {
  const startVolume = useSharedValue(1);
  const active = useSharedValue(false);
  const fallbackWindow = Dimensions.get('window');
  const effectiveWidth = layoutWidth > 0 ? layoutWidth : fallbackWindow.width;
  const effectiveHeight = layoutHeight > 0 ? layoutHeight : fallbackWindow.height;

  const captureStart = () => {
    startVolume.value = snapshot.current.volume;
  };

  const apply = (v: number) => {
    const next = Math.max(0, Math.min(1, v));
    try {
      player.volume = next;
      onUpdate?.(next);
    } catch {
      // ignore
    }
  };

  const clear = () => onUpdate?.(null);

  // Web: HTMLMediaElement supports volume, so this works there too
  if (Platform.OS === 'web' || Platform.OS === 'ios' || Platform.OS === 'android') {
    return Gesture.Pan()
      .activeOffsetY([-12, 12])
      .failOffsetX([-20, 20])
      .onBegin((e) => {
        if (e.x < effectiveWidth / 2) {
          active.value = false;
          return;
        }
        active.value = true;
        runOnJS(captureStart)();
      })
      .onUpdate((e) => {
        if (!active.value) return;
        const ratio = -e.translationY / Math.max(1, effectiveHeight);
        runOnJS(apply)(startVolume.value + ratio);
      })
      .onFinalize(() => {
        active.value = false;
        runOnJS(clear)();
      });
  }

  return Gesture.Pan().enabled(false);
}
