import type { VideoPlayer } from 'expo-video';
import { Gesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-worklets';

import type { PlayerSnapshotRef } from './usePlayerSnapshot';

type Options = {
  player: VideoPlayer;
  snapshot: PlayerSnapshotRef;
  boostedRate?: number;
  onChange?: (boosted: boolean) => void;
};

export function useLongPressSpeed({ player, snapshot, boostedRate = 2, onChange }: Options) {
  const start = () => {
    if (snapshot.current.status !== 'readyToPlay') return;
    try {
      player.playbackRate = boostedRate;
      onChange?.(true);
    } catch {
      // ignore
    }
  };
  const stop = () => {
    try {
      player.playbackRate = 1;
    } catch {
      // ignore
    }
    onChange?.(false);
  };

  return Gesture.LongPress()
    .minDuration(350)
    .onStart(() => {
      runOnJS(start)();
    })
    .onFinalize(() => {
      runOnJS(stop)();
    });
}
