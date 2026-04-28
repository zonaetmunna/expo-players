import { useEvent } from 'expo';
import type { VideoPlayer, VideoPlayerStatus } from 'expo-video';
import { useEffect, useRef } from 'react';

export type PlayerSnapshot = {
  currentTime: number;
  duration: number;
  volume: number;
  status: VideoPlayerStatus;
  isLive: boolean;
};

export type PlayerSnapshotRef = { current: PlayerSnapshot };

export function usePlayerSnapshot(player: VideoPlayer): PlayerSnapshotRef {
  const ref = useRef<PlayerSnapshot>({
    currentTime: 0,
    duration: 0,
    volume: 1,
    status: 'idle',
    isLive: false,
  });

  useEffect(() => {
    player.timeUpdateEventInterval = 0.25;
  }, [player]);

  const { currentTime } = useEvent(player, 'timeUpdate', {
    currentTime: player.currentTime,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
    bufferedPosition: 0,
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const { volume } = useEvent(player, 'volumeChange', { volume: player.volume });

  useEffect(() => {
    ref.current.currentTime = currentTime ?? 0;
  }, [currentTime]);

  useEffect(() => {
    ref.current.status = status;
    try {
      ref.current.duration = player.duration ?? 0;
      ref.current.isLive = player.isLive ?? false;
    } catch {
      // player may not yet be ready — leave previous values
    }
  }, [status, player]);

  useEffect(() => {
    ref.current.volume = volume ?? 1;
  }, [volume]);

  return ref;
}
