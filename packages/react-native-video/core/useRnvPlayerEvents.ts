// Owns the reactive snapshot of player state and the 6 native event handlers
// that feed it. Hot fields (currentTime, buffering) bypass React state entirely
// — they're written directly into the snapshot ref. Consumers that need to
// render them (the scrubber) subscribe via useCurrentTime / useBuffering.
// This keeps onProgress (4Hz, perpetual) from re-rendering the whole tree.

import { useCallback, useState } from 'react';
import type { OnLoadData, OnProgressData } from 'react-native-video';

import type { RnvSnapshot } from '../types/types';
import type { RnvSnapshotRef } from './useRnvPlayerSnapshot';

/** Cold-state slice — only fields that re-render the React tree on change. */
export type RnvColdState = Omit<RnvSnapshot, 'currentTime' | 'buffering'>;

type Options = {
  /** Snapshot ref shared with gestures + scrubber. We mutate hot fields here directly. */
  snapshot: RnvSnapshotRef;
  initialVolume: number;
  autoPlay: boolean;
  initialDuration: number;
  onEnd: () => void;
};

export type RnvPlayerEvents = {
  state: RnvColdState;
  setState: React.Dispatch<React.SetStateAction<RnvColdState>>;
  selectVideoTrack: (index: number | 'auto') => void;
  selectAudioTrack: (index: number | null) => void;
  selectTextTrack: (index: number | null) => void;
  videoEventProps: {
    onLoadStart: () => void;
    onLoad: (data: OnLoadData) => void;
    onProgress: (data: OnProgressData) => void;
    onBuffer: (e: { isBuffering: boolean }) => void;
    onPlaybackStateChanged: (e: { isPlaying: boolean }) => void;
    onVolumeChange: (e: { volume: number }) => void;
    onEnd: () => void;
  };
};

export function useRnvPlayerEvents({
  snapshot,
  initialVolume,
  autoPlay,
  initialDuration,
  onEnd,
}: Options): RnvPlayerEvents {
  const [state, setState] = useState<RnvColdState>({
    duration: initialDuration,
    volume: initialVolume,
    isLoaded: false,
    isPlaying: autoPlay,
    videoTracks: [],
    selectedVideoTrack: 'auto',
    audioTracks: [],
    selectedAudioTrack: null,
    textTracks: [],
    selectedTextTrack: null,
  });

  const handleLoadStart = useCallback(() => {
    if (__DEV__) console.log('[rn-video] onLoadStart');
  }, []);

  const handleLoad = useCallback(
    (data: OnLoadData) => {
      if (__DEV__) {
        console.log('[rn-video] onLoad', {
          duration: data.duration,
          tracks: data.videoTracks?.length,
        });
      }
      // Sync hot snapshot too so gesture worklets have correct duration.
      snapshot.current.duration = data.duration;
      snapshot.current.isLoaded = true;
      setState((s) => ({
        ...s,
        duration: data.duration,
        isLoaded: true,
        videoTracks: data.videoTracks.map((t) => ({
          index: t.index,
          width: t.width,
          height: t.height,
          bitrate: t.bitrate,
        })),
        audioTracks: data.audioTracks.map((t) => ({
          index: t.index,
          title: t.title,
          language: t.language,
        })),
        textTracks: data.textTracks.map((t) => ({
          index: t.index,
          title: t.title,
          language: t.language,
        })),
      }));
    },
    [snapshot]
  );

  // Hot field — write directly to ref, NO React re-render.
  const handleProgress = useCallback(
    (data: OnProgressData) => {
      snapshot.current.currentTime = data.currentTime;
    },
    [snapshot]
  );

  // Hot field — write directly to ref, NO React re-render.
  const handleBuffer = useCallback(
    ({ isBuffering }: { isBuffering: boolean }) => {
      snapshot.current.buffering = isBuffering;
    },
    [snapshot]
  );

  const handlePlaybackStateChanged = useCallback(
    ({ isPlaying }: { isPlaying: boolean }) => {
      snapshot.current.isPlaying = isPlaying;
      setState((s) => (s.isPlaying === isPlaying ? s : { ...s, isPlaying }));
    },
    [snapshot]
  );

  const handleVolumeChange = useCallback(
    ({ volume }: { volume: number }) => {
      snapshot.current.volume = volume;
      setState((s) => ({ ...s, volume }));
    },
    [snapshot]
  );

  const selectVideoTrack = useCallback(
    (index: number | 'auto') => {
      snapshot.current.selectedVideoTrack = index;
      setState((s) => ({ ...s, selectedVideoTrack: index }));
    },
    [snapshot]
  );

  const selectAudioTrack = useCallback(
    (index: number | null) => {
      snapshot.current.selectedAudioTrack = index;
      setState((s) => ({ ...s, selectedAudioTrack: index }));
    },
    [snapshot]
  );

  const selectTextTrack = useCallback(
    (index: number | null) => {
      snapshot.current.selectedTextTrack = index;
      setState((s) => ({ ...s, selectedTextTrack: index }));
    },
    [snapshot]
  );

  return {
    state,
    setState,
    selectVideoTrack,
    selectAudioTrack,
    selectTextTrack,
    videoEventProps: {
      onLoadStart: handleLoadStart,
      onLoad: handleLoad,
      onProgress: handleProgress,
      onBuffer: handleBuffer,
      onPlaybackStateChanged: handlePlaybackStateChanged,
      onVolumeChange: handleVolumeChange,
      onEnd,
    },
  };
}
