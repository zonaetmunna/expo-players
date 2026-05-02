// Owns the reactive snapshot of player state and the 6 native event handlers
// that feed it. Keeps VideoPlayer.tsx free of plumbing — the component just
// spreads the returned `videoEventProps` onto <Video> and reads `state` for
// rendering.
//
// Track-selection setters live here too because they're trivially small and
// belong with the state they mutate.

import { useCallback, useState } from 'react';
import type { OnLoadData, OnProgressData } from 'react-native-video';

import type { RnvSnapshot } from '../types';

type Options = {
  /** Initial volume — passed in so consumer can persist it across mounts. */
  initialVolume: number;
  /** When false, the player starts paused; this seeds `state.isPlaying`. */
  autoPlay: boolean;
  /** Initial duration from VideoItem metadata before the real onLoad fires. */
  initialDuration: number;
  /** Called when the file finishes (caller decides whether to loop / show end UI). */
  onEnd: () => void;
};

export type RnvPlayerEvents = {
  /** Reactive state snapshot — pass this to skins for rendering. */
  state: RnvSnapshot;
  /** Setter to mark `isLoaded: false` etc. when the source changes. */
  setState: React.Dispatch<React.SetStateAction<RnvSnapshot>>;
  /** Track-selection setters — wired into SettingsSheet via skin props. */
  selectVideoTrack: (index: number | 'auto') => void;
  selectAudioTrack: (index: number | null) => void;
  selectTextTrack: (index: number | null) => void;
  /** Spread these onto the <Video> component to wire up event handlers. */
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
  initialVolume,
  autoPlay,
  initialDuration,
  onEnd,
}: Options): RnvPlayerEvents {
  const [state, setState] = useState<RnvSnapshot>({
    currentTime: 0,
    duration: initialDuration,
    volume: initialVolume,
    buffering: false,
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
    // Useful for diagnostics — not all platforms fire this consistently.
    // eslint-disable-next-line no-console
    console.log('[rn-video] onLoadStart');
  }, []);

  const handleLoad = useCallback((data: OnLoadData) => {
    // eslint-disable-next-line no-console
    console.log('[rn-video] onLoad', {
      duration: data.duration,
      tracks: data.videoTracks?.length,
    });
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
  }, []);

  const handleProgress = useCallback((data: OnProgressData) => {
    setState((s) => ({ ...s, currentTime: data.currentTime }));
  }, []);

  const handleBuffer = useCallback(({ isBuffering }: { isBuffering: boolean }) => {
    setState((s) => ({ ...s, buffering: isBuffering }));
  }, []);

  const handlePlaybackStateChanged = useCallback(({ isPlaying }: { isPlaying: boolean }) => {
    // eslint-disable-next-line no-console
    console.log('[rn-video] onPlaybackStateChanged from native:', isPlaying);
    setState((s) => ({ ...s, isPlaying }));
  }, []);

  const handleVolumeChange = useCallback(({ volume }: { volume: number }) => {
    setState((s) => ({ ...s, volume }));
  }, []);

  const selectVideoTrack = useCallback((index: number | 'auto') => {
    setState((s) => ({ ...s, selectedVideoTrack: index }));
  }, []);

  const selectAudioTrack = useCallback((index: number | null) => {
    setState((s) => ({ ...s, selectedAudioTrack: index }));
  }, []);

  const selectTextTrack = useCallback((index: number | null) => {
    setState((s) => ({ ...s, selectedTextTrack: index }));
  }, []);

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
