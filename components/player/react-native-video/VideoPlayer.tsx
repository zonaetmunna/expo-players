import * as ScreenOrientation from 'expo-screen-orientation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, StatusBar, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Video, {
  ResizeMode as RnvResizeMode,
  SelectedTrackType,
  SelectedVideoTrackType,
  TextTrackType,
  type ISO639_1,
  type OnLoadData,
  type OnProgressData,
  type OnReceiveAdEventData,
  type OnVideoErrorData,
  type SelectedTrack,
  type SelectedVideoTrack,
  type VideoRef,
} from 'react-native-video';

import { CastIndicator } from './CastIndicator';
import { CustomControls } from './CustomControls';
import { PlayerGestures } from './PlayerGestures';
import {
  INITIAL_AD_STATE,
  isAdsPlatformSupported,
  mapAds,
  reduceAdEvent,
  validateAds,
  type AdPlayerState,
} from './ads';
import { describeDrmError, isDrmSchemeSupported, mapDrm, validateDrm } from './drm';
import { useCastSession } from './hooks/useCastSession';
import { useRnvPlayerSnapshot } from './hooks/useRnvPlayerSnapshot';
import type { ResizeMode } from './resizeMode';
import type { SkinId } from './skins';
import type { RnvSnapshot, VideoItem } from './types';

type Props = {
  source: VideoItem;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  initialVolume?: number;
  initialResizeMode?: ResizeMode;
  initialSkin?: SkinId;
  gesturesEnabled?: boolean;
  onRequestBack?: () => void;
  style?: ViewStyle;
};

/** Map our string-literal ResizeMode to rn-video v6's ResizeMode enum.
 * rn-video v6 expects the enum values for live updates to take effect on iOS. */
function mapResizeMode(mode: ResizeMode): RnvResizeMode {
  switch (mode) {
    case 'cover':
      return RnvResizeMode.COVER;
    case 'stretch':
      return RnvResizeMode.STRETCH;
    case 'none':
      return RnvResizeMode.NONE;
    case 'contain':
    default:
      return RnvResizeMode.CONTAIN;
  }
}

function mapVideoTrackSelection(sel: number | 'auto'): SelectedVideoTrack {
  if (sel === 'auto') return { type: SelectedVideoTrackType.AUTO };
  return { type: SelectedVideoTrackType.INDEX, value: sel };
}

function mapAudioTrackSelection(sel: number | null): SelectedTrack | undefined {
  if (sel === null) return undefined;
  return { type: SelectedTrackType.INDEX, value: sel };
}

function mapTextTrackSelection(sel: number | null): SelectedTrack {
  if (sel === null) return { type: SelectedTrackType.DISABLED };
  return { type: SelectedTrackType.INDEX, value: sel };
}

export function VideoPlayer({
  source,
  autoPlay = true,
  loop = false,
  muted = false,
  initialVolume = 1,
  initialResizeMode = 'contain',
  initialSkin = 'default',
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

  // Compatibility check: surface a banner instead of mounting <Video> with sources
  // that the platform fundamentally can't decode (rn-video would emit an opaque
  // error otherwise). DRM checks live here too so we never hand a bad config to
  // rn-video — it would emit a vague native error several seconds later.
  const compatError = (() => {
    if (Platform.OS === 'ios' && source.type === 'dash') {
      return 'MPEG-DASH is not supported on iOS. Use HLS or progressive MP4 instead.';
    }
    if (Platform.OS === 'ios' && source.type === 'webm') {
      return 'WebM is not supported on iOS. Use MP4 or HLS instead.';
    }
    if (Platform.OS === 'ios' && source.type === 'ogg') {
      return 'OGG/Theora is not supported on iOS.';
    }
    if (source.drm) {
      const reason = validateDrm(source.drm);
      if (reason) return `DRM config error — ${reason}`;
      if (!isDrmSchemeSupported(source.drm.type)) {
        if (Platform.OS === 'web') {
          return 'DRM-protected streams are not supported on web. Open this title on iOS or Android.';
        }
        if (Platform.OS === 'ios' && source.drm.type !== 'fairplay') {
          return `iOS only supports FairPlay DRM — this stream uses ${source.drm.type}.`;
        }
        if (Platform.OS === 'android' && source.drm.type === 'fairplay') {
          return 'FairPlay is iOS-only. This stream needs a Widevine variant for Android playback.';
        }
        return `${source.drm.type} DRM is not supported on this platform.`;
      }
    }
    if (source.ads) {
      const reason = validateAds(source.ads);
      if (reason) return `Ads config error — ${reason}`;
      if (!isAdsPlatformSupported()) {
        return 'Ads (IMA SDK) are not supported on web. Content will play without ads.';
      }
    }
    return null;
  })();

  const [paused, setPaused] = useState(!autoPlay);
  const [rate, setRate] = useState(1);
  const [resizeMode, setResizeMode] = useState<ResizeMode>(initialResizeMode);
  const [skin, setSkin] = useState<SkinId>(initialSkin);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [isEnded, setIsEnded] = useState(false);
  // IMA ad state — driven by onReceiveAdEvent. The IMA SDK renders the actual
  // ad UI (skip button, countdown, click-through) natively over the Video
  // surface; we use this to hide our own controls during an ad break and to
  // surface ad errors without breaking content playback.
  const [adState, setAdState] = useState<AdPlayerState>(INITIAL_AD_STATE);

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

  // Reset transient playback state when the source changes (different video selected)
  useEffect(() => {
    setIsEnded(false);
    setError(null);
    setPaused(!autoPlay);
    setRate(1);
    setAdState(INITIAL_AD_STATE);
  }, [source.id, autoPlay]);

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
    // Live streams have no defined timeline — block seek to avoid sending invalid
    // positions to the player or to the Cast receiver (which may interpret weirdly).
    if (source.isLive) return;
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
    // Dump every property of the error object so we can see what platform reports.
    // Native error payloads on iOS sometimes contain circular references → guard JSON.stringify.
    let serialized: string;
    try {
      serialized = JSON.stringify(e, null, 2);
    } catch {
      serialized = String(e);
    }
    // eslint-disable-next-line no-console
    console.warn('[rn-video] onError raw:', serialized);

    // If the source uses DRM and the error matches a known DRM signature, surface
    // a tailored message — much more actionable than the raw native error string.
    if (source.drm) {
      const drmMsg = describeDrmError(e);
      if (drmMsg) {
        setError(drmMsg);
        return;
      }
    }

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

  // IMA ad-event router. The IMA SDK takes over the surface during ad breaks
  // (CONTENT_PAUSE_REQUESTED → CONTENT_RESUME_REQUESTED) and renders its own
  // skip / countdown / click-through chrome. We just track the state so our
  // custom controls hide themselves while ads play.
  const handleAdEvent = (e: OnReceiveAdEventData) => {
    const eventName = e?.event ?? 'UNKNOWN';
    // eslint-disable-next-line no-console
    console.log('[rn-video] onReceiveAdEvent', eventName, e?.data);
    setAdState((prev) => reduceAdEvent(prev, eventName, e?.data));
  };

  // Memoize the source object so rn-video doesn't see a "new" prop every render
  // (which causes it to reload + rebuffer the stream).
  const videoSource = useMemo(() => {
    const mappedAd = mapAds(source.ads);
    if (source.ads) {
      // eslint-disable-next-line no-console
      console.log('[rn-video] ads config attached to source', {
        title: source.title,
        rawAds: source.ads,
        mappedAd,
      });
    }
    return {
      uri: source.uri,
      // Let rn-video auto-detect from the URL extension (.m3u8 / .mpd / .mp4).
      headers: source.drm?.headers,
      drm: mapDrm(source.drm),
      ad: mappedAd,
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
    };
  }, [source]);

  const playerBody = (
    <View
      style={
        isFullscreen
          ? styles.fullscreenContainer
          : [styles.inlineContainer, style]
      }>

      <PlayerGestures
        snapshot={snapshot}
        isLive={!!source.isLive}
        isPlayingState={state.isPlaying && !isEnded}
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
          resizeMode={mapResizeMode(resizeMode)}
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
          onReceiveAdEvent={source.ads ? handleAdEvent : undefined}
        />
      </PlayerGestures>

      {cast.isCasting ? (
        <CastIndicator
          deviceName={cast.device?.friendlyName}
          loadError={cast.loadError}
        />
      ) : null}

      {compatError ? (
        <View style={styles.compatBanner} pointerEvents="none">
          <Text style={styles.compatBannerText}>{compatError}</Text>
        </View>
      ) : null}

      <CustomControls
        snapshot={snapshot}
        state={state}
        title={source.title}
        isLive={!!source.isLive}
        hasError={!!error}
        errorMessage={error}
        isInAdBreak={adState.inAdBreak}
        isEnded={isEnded}
        rate={rate}
        resizeMode={resizeMode}
        isFullscreen={isFullscreen}
        canCast={cast.canCast}
        isCasting={cast.isCasting}
        spriteThumbnails={source.spriteThumbnails}
        skin={skin}
        onSelectSkin={setSkin}
        onPlay={onPlay}
        onPause={onPause}
        onReplay={onReplay}
        onSeek={seekTo}
        onSetRate={setRateImperative}
        onSelectVideoTrack={onSelectVideoTrack}
        onSelectAudioTrack={onSelectAudioTrack}
        onSelectTextTrack={onSelectTextTrack}
        onSelectResizeMode={setResizeMode}
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

  return playerBody;
}

const styles = StyleSheet.create({
  inlineContainer: {
    width: '100%',
    backgroundColor: 'black',
    // No fixed aspect ratio — the consumer screen decides the height via
    // the `style` prop. Sensible default: 16:9 if the consumer didn't pass one.
    aspectRatio: 16 / 9,
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  compatBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(220, 38, 38, 0.92)',
    zIndex: 10,
  },
  compatBannerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
