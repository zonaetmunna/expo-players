import * as ScreenOrientation from 'expo-screen-orientation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, StatusBar, StyleSheet, View, type ViewStyle } from 'react-native';
import Video, {
  type ISO639_1,
  type OnLoadData,
  type OnProgressData,
  type OnVideoErrorData,
  type SelectedTrack,
  type SelectedVideoTrack,
  type TextTrackType,
  type VideoRef,
} from 'react-native-video';

import { CastIndicator } from './CastIndicator';
import { CustomControls } from './CustomControls';
import { PlayerGestures } from './PlayerGestures';
import { useCastSession } from './hooks/useCastSession';
import { useRnvPlayerSnapshot } from './hooks/useRnvPlayerSnapshot';
import type { ResizeMode } from './resizeMode';
import type { RnvSnapshot, VideoItem } from './types';

type Props = {
  source: VideoItem;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  initialVolume?: number;
  initialResizeMode?: ResizeMode;
  gesturesEnabled?: boolean;
  onRequestBack?: () => void;
  style?: ViewStyle;
};

function mapVideoTrackSelection(sel: number | 'auto'): SelectedVideoTrack {
  if (sel === 'auto') return { type: 'auto' as never };
  return { type: 'index' as never, value: sel };
}

function mapAudioTrackSelection(sel: number | null): SelectedTrack | undefined {
  if (sel === null) return undefined;
  return { type: 'index' as never, value: sel };
}

function mapTextTrackSelection(sel: number | null): SelectedTrack {
  if (sel === null) return { type: 'disabled' as never };
  return { type: 'index' as never, value: sel };
}

export function VideoPlayer({
  source,
  autoPlay = true,
  loop = false,
  muted = false,
  initialVolume = 1,
  initialResizeMode = 'contain',
  gesturesEnabled = true,
  onRequestBack,
  style,
}: Props) {
  const videoRef = useRef<VideoRef>(null);
  const snapshot = useRnvPlayerSnapshot();

  // Reactive state mirrored from rn-video events
  const [state, setState] = useState<RnvSnapshot>({
    currentTime: 0,
    duration: source.duration ?? 0,
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

  const [paused, setPaused] = useState(!autoPlay);
  const [rate, setRate] = useState(1);
  const [resizeMode, setResizeMode] = useState<ResizeMode>(initialResizeMode);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [isEnded, setIsEnded] = useState(false);

  // Mirror reactive state -> snapshot ref for gesture hooks (worklets read this safely on JS thread)
  useEffect(() => {
    snapshot.current = state;
  }, [state, snapshot]);

  // === Cast session — managed in its own hook ===
  // Defined here so `onCastStart`/`onCastEnd` can reach the local player state.
  const handleCastStart = useCallback(() => {
    // Pause local playback when handoff begins
    setPaused(true);
  }, []);
  const handleCastEnd = useCallback((lastPositionSec: number) => {
    // Resume locally at the position the receiver was at
    if (Number.isFinite(lastPositionSec) && lastPositionSec > 0) {
      videoRef.current?.seek(lastPositionSec);
    }
    setPaused(false);
  }, []);
  const cast = useCastSession({
    source,
    onCastStart: handleCastStart,
    onCastEnd: handleCastEnd,
  });

  // Reset orientation + restore status bar on unmount
  useEffect(() => {
    return () => {
      ScreenOrientation.unlockAsync().catch(() => {});
      StatusBar.setHidden(false, 'fade');
      if (Platform.OS === 'android') {
        StatusBar.setTranslucent(false);
      }
    };
  }, []);

  // Imperatively control the status bar based on fullscreen state.
  // expo-status-bar / <StatusBar /> inside Modal is unreliable on Android — this runs
  // on the root view regardless of where this component is mounted.
  useEffect(() => {
    if (isFullscreen) {
      StatusBar.setHidden(true, 'fade');
      if (Platform.OS === 'android') {
        StatusBar.setTranslucent(true);
      }
    } else {
      StatusBar.setHidden(false, 'fade');
      if (Platform.OS === 'android') {
        StatusBar.setTranslucent(false);
      }
    }
  }, [isFullscreen]);

  // === Imperative actions — routed to cast session when casting, else local ===
  const seekTo = (time: number) => {
    // Any seek that goes back from the end should clear the "ended" flag
    setIsEnded(false);
    cast.remoteSeek(time).then((handled) => {
      if (!handled) videoRef.current?.seek(time);
    });
  };

  const setRateImperative = (r: number) => {
    cast.remoteSetRate(r);
    setRate(r);
  };

  const onPlay = () => {
    // Short-circuit when not casting — avoids 50–200ms await before local play resumes.
    if (!cast.isCasting) {
      setPaused(false);
      return;
    }
    cast.remotePlay().then((handled) => {
      if (!handled) setPaused(false);
    });
  };
  const onPause = () => {
    if (!cast.isCasting) {
      setPaused(true);
      return;
    }
    cast.remotePause().then((handled) => {
      if (!handled) setPaused(true);
    });
  };

  const onSelectVideoTrack = (index: number | 'auto') => {
    setState((s) => ({ ...s, selectedVideoTrack: index }));
  };
  const onSelectAudioTrack = (index: number | null) => {
    setState((s) => ({ ...s, selectedAudioTrack: index }));
  };
  const onSelectTextTrack = (index: number | null) => {
    setState((s) => ({ ...s, selectedTextTrack: index }));
  };

  const onToggleFullscreen = async () => {
    try {
      if (isFullscreen) {
        await ScreenOrientation.unlockAsync();
        setIsFullscreen(false);
      } else {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        setIsFullscreen(true);
      }
    } catch {
      // ignore — orientation lock denied
    }
  };

  const onRequestPiP = () => {
    try {
      videoRef.current?.enterPictureInPicture();
    } catch {
      // ignore
    }
  };

  const onRetry = () => {
    setError(null);
    setReloadKey((k) => k + 1);
  };

  // === rn-video event handlers ===
  const handleLoadStart = () => {
    // eslint-disable-next-line no-console
    console.log('[rn-video] onLoadStart for', source.uri);
  };

  const handleLoad = (data: OnLoadData) => {
    // eslint-disable-next-line no-console
    console.log('[rn-video] onLoad', { duration: data.duration, tracks: data.videoTracks?.length });
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
  };

  const handleProgress = (data: OnProgressData) => {
    setState((s) => ({ ...s, currentTime: data.currentTime }));
  };

  const handleBuffer = ({ isBuffering }: { isBuffering: boolean }) => {
    setState((s) => ({ ...s, buffering: isBuffering }));
  };

  const handlePlaybackStateChanged = ({ isPlaying }: { isPlaying: boolean }) => {
    setState((s) => ({ ...s, isPlaying }));
  };

  const handleEnd = () => {
    if (!loop) {
      setPaused(true);
      setIsEnded(true);
    }
  };

  const onReplay = () => {
    videoRef.current?.seek(0);
    setIsEnded(false);
    setPaused(false);
  };

  const handleError = (e: OnVideoErrorData) => {
    // Dump every property of the error object so we can see what platform reports
    // eslint-disable-next-line no-console
    console.warn('[rn-video] onError raw:', JSON.stringify(e, null, 2));

    const err = (e?.error ?? e) as Record<string, unknown> | undefined;
    const parts: string[] = [];
    if (err) {
      for (const key of [
        'errorString',
        'localizedDescription',
        'localizedFailureReason',
        'errorCode',
        'code',
        'domain',
        'errorException',
        'errorStackTrace',
      ]) {
        const v = err[key];
        if (v != null && v !== '') parts.push(`${key}: ${String(v).slice(0, 100)}`);
      }
    }
    const msg = parts.length > 0 ? parts.join('\n') : 'Playback failed (no error details)';
    setError(msg);
  };

  const handleVolumeChange = ({ volume }: { volume: number }) => {
    setState((s) => ({ ...s, volume }));
  };

  // Memoize the source object so rn-video doesn't see a "new" prop every render
  // (which causes it to reload + rebuffer the stream).
  const videoSource = useMemo(
    () => ({
      uri: source.uri,
      // Let rn-video auto-detect from the URL extension (.m3u8 / .mpd / .mp4).
      headers: source.drm?.headers,
      drm: source.drm
        ? {
            type: source.drm.type as never,
            licenseServer: source.drm.licenseServer,
            headers: source.drm.headers,
            contentId: source.drm.contentId,
            certificateUrl: source.drm.certificateUrl,
          }
        : undefined,
      metadata: {
        title: source.title,
        description: source.description,
        imageUri: source.poster,
      },
      textTracks: source.subtitles?.map((s) => ({
        title: s.title,
        language: s.language as ISO639_1,
        type:
          s.type === 'vtt'
            ? ('text/vtt' as TextTrackType)
            : s.type === 'ttml'
              ? ('application/ttml+xml' as TextTrackType)
              : ('application/x-subrip' as TextTrackType),
        uri: s.uri,
      })),
    }),
    [source]
  );

  const playerBody = (
    <View style={isFullscreen ? styles.fullscreenContainer : styles.inlineContainer}>
      <PlayerGestures
        snapshot={snapshot}
        isLive={!!source.isLive}
        resizeMode={resizeMode}
        onResizeModeChange={setResizeMode}
        seekTo={seekTo}
        setRate={setRateImperative}
        enabled={gesturesEnabled}>
        <Video
          key={reloadKey}
          ref={videoRef}
          source={videoSource}
          style={StyleSheet.absoluteFill}
          paused={paused}
          muted={muted}
          repeat={loop}
          rate={rate}
          volume={state.volume}
          resizeMode={resizeMode}
          selectedVideoTrack={mapVideoTrackSelection(state.selectedVideoTrack)}
          selectedAudioTrack={mapAudioTrackSelection(state.selectedAudioTrack)}
          selectedTextTrack={mapTextTrackSelection(state.selectedTextTrack)}
          playInBackground
          showNotificationControls
          enterPictureInPictureOnLeave
          progressUpdateInterval={250}
          onLoadStart={handleLoadStart}
          onLoad={handleLoad}
          onProgress={handleProgress}
          onBuffer={handleBuffer}
          onPlaybackStateChanged={handlePlaybackStateChanged}
          onVolumeChange={handleVolumeChange}
          onEnd={handleEnd}
          onError={handleError}
        />
      </PlayerGestures>

      {cast.isCasting ? (
        <CastIndicator
          deviceName={cast.device?.friendlyName}
          loadError={cast.loadError}
        />
      ) : null}

      <CustomControls
        snapshot={snapshot}
        state={state}
        title={source.title}
        isLive={!!source.isLive}
        hasError={!!error}
        isEnded={isEnded}
        rate={rate}
        isFullscreen={isFullscreen}
        canCast={cast.canCast}
        spriteThumbnails={source.spriteThumbnails}
        onPlay={onPlay}
        onPause={onPause}
        onReplay={onReplay}
        onSeek={seekTo}
        onSetRate={setRateImperative}
        onSelectVideoTrack={onSelectVideoTrack}
        onSelectAudioTrack={onSelectAudioTrack}
        onSelectTextTrack={onSelectTextTrack}
        onToggleFullscreen={onToggleFullscreen}
        onRequestPiP={onRequestPiP}
        onRetry={onRetry}
        onRequestBack={isFullscreen ? onToggleFullscreen : onRequestBack}
      />
    </View>
  );

  if (isFullscreen) {
    return (
      <>
        {/* Inline placeholder keeps surrounding layout stable while fullscreen modal is open */}
        <View style={[styles.inlineContainer, style]} />
        <Modal
          visible
          animationType="fade"
          supportedOrientations={['landscape', 'portrait']}
          onRequestClose={onToggleFullscreen}
          statusBarTranslucent
          navigationBarTranslucent>
          {playerBody}
        </Modal>
      </>
    );
  }

  return <View style={style}>{playerBody}</View>;
}

const styles = StyleSheet.create({
  inlineContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: 'black',
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
});
