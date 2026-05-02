import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Video, { type ISO639_1, type TextTrackType, type VideoRef } from 'react-native-video';
import { isAdsPlatformSupported, mapAds, validateAds } from './ads';
import { CastIndicator } from './CastIndicator';
import { CustomControls } from './CustomControls';
import { isDrmSchemeSupported, mapDrm, validateDrm } from './drm';
import { useAdLifecycle } from './hooks/useAdLifecycle';
import { useCastSession } from './hooks/useCastSession';
import { useFullscreen } from './hooks/useFullscreen';
import { usePlayerError } from './hooks/usePlayerError';
import { useRnvPlayerEvents } from './hooks/useRnvPlayerEvents';
import { useRnvPlayerSnapshot } from './hooks/useRnvPlayerSnapshot';
import { PlayerGestures } from './PlayerGestures';
import type { ResizeMode } from './resizeMode';
import type { SkinId } from './skins';
import type { VideoItem } from './types';
import {
  mapAudioTrackSelection,
  mapResizeMode,
  mapTextTrackSelection,
  mapVideoTrackSelection,
} from './utils';

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

  // === UI-only state ===
  const [paused, setPaused] = useState(!autoPlay);
  const [rate, setRate] = useState(1);
  const [resizeMode, setResizeMode] = useState<ResizeMode>(initialResizeMode);
  const [skin, setSkin] = useState<SkinId>(initialSkin);
  const [isEnded, setIsEnded] = useState(false);

  // === Composed feature hooks ===
  const fullscreen = useFullscreen();
  const errorMgr = usePlayerError({ drm: source.drm });
  const ads = useAdLifecycle();

  // === Native event handlers + reactive state ===
  const handleEnd = useCallback(() => {
    if (!loop) {
      setPaused(true);
      setIsEnded(true);
    }
  }, [loop]);

  const events = useRnvPlayerEvents({
    initialVolume,
    autoPlay,
    initialDuration: source.duration ?? 0,
    onEnd: handleEnd,
  });

  // Mirror reactive state -> snapshot ref for gesture worklets (JS-thread safe).
  useEffect(() => {
    snapshot.current = events.state;
  }, [events.state, snapshot]);

  // === Compatibility check: surface a banner instead of mounting <Video>
  // with sources the platform fundamentally can't decode (rn-video would
  // emit an opaque error otherwise). DRM + Ads checks live here too so we
  // never hand a bad config to rn-video. ===
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

  // === Cast session — defined here so callbacks can reach local state ===
  const handleCastStart = useCallback(() => {
    setPaused(true);
  }, []);
  const handleCastEnd = useCallback((lastPositionSec: number) => {
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
    errorMgr.clearError();
    setPaused(!autoPlay);
    setRate(1);
    ads.reset();
    // errorMgr.clearError + ads.reset are stable refs — included by lint rule but won't change
  }, [source.id, autoPlay, errorMgr, ads]);

  // === Imperative actions — routed to cast session when casting, else local ===
  const seekTo = (time: number) => {
    // Live streams have no defined timeline — block seek to avoid sending invalid
    // positions to the player or to the Cast receiver (which may interpret weirdly).
    if (source.isLive) return;
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
    if (!cast.isCasting) {
      setPaused(false);
      return;
    }
    cast.remotePlay().then((handled) => {
      if (!handled) setPaused(false);
    });
  };
  const onPause = () => {
    // eslint-disable-next-line no-console
    console.log('[rnv] onPause called — isCasting:', cast.isCasting);
    if (!cast.isCasting) {
      setPaused(true);
      return;
    }
    cast.remotePause().then((handled) => {
      if (!handled) setPaused(true);
    });
  };

  const onRequestPiP = () => {
    try {
      videoRef.current?.enterPictureInPicture();
    } catch {
      // ignore
    }
  };

  const onReplay = () => {
    videoRef.current?.seek(0);
    setIsEnded(false);
    setPaused(false);
  };

  // Memoize the source object so rn-video doesn't see a "new" prop every render
  // (which causes it to reload + rebuffer the stream).
  const videoSource = useMemo(() => {
    const mappedAd = mapAds(source.ads);
    if (source.ads) {
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
        fullscreen.isFullscreen ? styles.fullscreenContainer : [styles.inlineContainer, style]
      }>
      <PlayerGestures
        snapshot={snapshot}
        isLive={!!source.isLive}
        isPlayingState={events.state.isPlaying && !isEnded}
        resizeMode={resizeMode}
        onResizeModeChange={setResizeMode}
        seekTo={seekTo}
        setRate={setRateImperative}
        enabled={gesturesEnabled}>
        <Video
          key={errorMgr.reloadKey}
          ref={videoRef}
          source={videoSource}
          style={StyleSheet.absoluteFill}
          paused={paused}
          muted={muted}
          repeat={loop}
          rate={rate}
          volume={events.state.volume}
          resizeMode={mapResizeMode(resizeMode)}
          selectedVideoTrack={mapVideoTrackSelection(events.state.selectedVideoTrack)}
          selectedAudioTrack={mapAudioTrackSelection(events.state.selectedAudioTrack)}
          selectedTextTrack={mapTextTrackSelection(events.state.selectedTextTrack)}
          playInBackground
          showNotificationControls
          enterPictureInPictureOnLeave
          progressUpdateInterval={250}
          {...events.videoEventProps}
          onError={errorMgr.handleError}
          onReceiveAdEvent={source.ads ? ads.handleAdEvent : undefined}
        />
      </PlayerGestures>

      {cast.isCasting ? (
        <CastIndicator deviceName={cast.device?.friendlyName} loadError={cast.loadError} />
      ) : null}

      {compatError ? (
        <View style={styles.compatBanner} pointerEvents="none">
          <Text style={styles.compatBannerText}>{compatError}</Text>
        </View>
      ) : null}

      <CustomControls
        snapshot={snapshot}
        state={events.state}
        title={source.title}
        isLive={!!source.isLive}
        hasError={!!errorMgr.error}
        errorTitle={errorMgr.error?.title}
        errorHint={errorMgr.error?.hint}
        errorRetryable={errorMgr.error?.retryable}
        isInAdBreak={ads.adState.inAdBreak}
        isEnded={isEnded}
        rate={rate}
        resizeMode={resizeMode}
        isFullscreen={fullscreen.isFullscreen}
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
        onSelectVideoTrack={events.selectVideoTrack}
        onSelectAudioTrack={events.selectAudioTrack}
        onSelectTextTrack={events.selectTextTrack}
        onSelectResizeMode={setResizeMode}
        onToggleFullscreen={fullscreen.toggle}
        onRequestPiP={onRequestPiP}
        onRetry={errorMgr.onRetry}
        onRequestBack={fullscreen.isFullscreen ? fullscreen.toggle : onRequestBack}
      />
    </View>
  );

  if (fullscreen.isFullscreen) {
    return (
      <>
        {/* Inline placeholder keeps surrounding layout stable while fullscreen modal is open */}
        <View style={[styles.inlineContainer, style]} />
        <Modal
          visible
          animationType="fade"
          supportedOrientations={['landscape', 'portrait']}
          onRequestClose={fullscreen.toggle}
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
