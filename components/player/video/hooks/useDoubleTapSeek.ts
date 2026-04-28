import type { VideoPlayer } from 'expo-video';
import { Gesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-worklets';

import type { PlayerSnapshotRef } from './usePlayerSnapshot';

type Options = {
  player: VideoPlayer;
  snapshot: PlayerSnapshotRef;
  layoutWidth: number;
  seekSeconds?: number;
  onSeek?: (direction: 'forward' | 'backward', seconds: number) => void;
};

export function useDoubleTapSeek({
  player,
  snapshot,
  layoutWidth,
  seekSeconds = 10,
  onSeek,
}: Options) {
  const seek = (dir: 'forward' | 'backward') => {
    const snap = snapshot.current;
    if (snap.status !== 'readyToPlay' || snap.isLive) return;
    const delta = dir === 'forward' ? seekSeconds : -seekSeconds;
    try {
      player.seekBy(delta);
      onSeek?.(dir, seekSeconds);
    } catch {
      // ignore
    }
  };

  return Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(250)
    .onEnd((event) => {
      const isForward = event.x > layoutWidth / 2;
      runOnJS(seek)(isForward ? 'forward' : 'backward');
    });
}
