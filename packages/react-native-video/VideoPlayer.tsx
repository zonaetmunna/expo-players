import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Video, { type ISO639_1, type TextTrackType, type VideoRef } from 'react-native-video';
import {
  mapAudioTrackSelection,
  mapResizeMode,
  mapTextTrackSelection,
  mapVideoTrackSelection,
} from './core/mappers';
import type { ResizeMode } from './core/resizeMode';
import { useFullscreen } from './core/useFullscreen';
import { usePlayerError } from './core/usePlayerError';
import { useRnvPlayerEvents } from './core/useRnvPlayerEvents';
import { useRnvPlayerSnapshot } from './core/useRnvPlayerSnapshot';
import { isAdsPlatformSupported, mapAds, validateAds } from './features/ads/ads';
import { useAdLifecycle } from './features/ads/useAdLifecycle';
import { CastIndicator } from './features/cast/CastIndicator';
import { useCastSession } from './features/cast/useCastSession';
import { isDrmSchemeSupported, mapDrm, validateDrm } from './features/drm/drm';
import { PlayerGestures } from './features/gestures/PlayerGestures';
import type { SkinId } from './features/skins';
import { CustomControls } from './features/skins/CustomControls';
import type { VideoItem } from './types/types';

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

  // No local `paused` state — runtime play/pause goes through videoRef
  // (the prop races with the media-session service).
  const [rate, setRate] = useState(1);
  const [resizeMode, setResizeMode] = useState<ResizeMode>(initialResizeMode);
  const [skin, setSkin] = useState<SkinId>(initialSkin);
  const [isEnded, setIsEnded] = useState(false);

  const fullscreen = useFullscreen();
  const errorMgr = usePlayerError({ drm: source.drm });
  const ads = useAdLifecycle();

  const handleEnd = useCallback(() => {
    if (!loop) {
      videoRef.current?.pause();
      setIsEnded(true);
    }
  }, [loop]);

  const events = useRnvPlayerEvents({
    initialVolume,
    autoPlay,
    initialDuration: source.duration ?? 0,
    onEnd: handleEnd,
  });

  // Mirror state into a ref so gesture worklets can read it on the JS thread.
  useEffect(() => {
    snapshot.current = events.state;
  }, [events.state, snapshot]);

  // Surface a banner instead of handing rn-video a config it can't play.
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

  // Cast handoff: pause local on start, resume at receiver's position on end.
  const handleCastStart = useCallback(() => {
    videoRef.current?.pause();
  }, []);
  const handleCastEnd = useCallback((lastPositionSec: number) => {
    if (Number.isFinite(lastPositionSec) && lastPositionSec > 0) {
      videoRef.current?.seek(lastPositionSec);
    }
    videoRef.current?.resume();
  }, []);
  const cast = useCastSession({
    source,
    onCastStart: handleCastStart,
    onCastEnd: handleCastEnd,
  });

  // Reset transient state on source change. sourceId is read in the body so
  // exhaustive-deps sees it as the real trigger.
  const sourceId = source.id;
  useEffect(() => {
    console.log('[rn-video] reset for source', sourceId);
    setIsEnded(false);
    errorMgr.clearError();
    setRate(1);
    ads.reset();
  }, [sourceId, errorMgr, ads]);

  // Imperative actions — routed to cast session when active, else local.
  const seekTo = (time: number) => {
    if (source.isLive) return; // live has no scrubbable timeline
    setIsEnded(false);
    cast.remoteSeek(time).then((handled) => {
      if (!handled) videoRef.current?.seek(time);
    });
  };

  const setRateImperative = (r: number) => {
    cast.remoteSetRate(r);
    setRate(r);
  };

  // Imperative pause/resume — the `paused` prop loses races with the media session.
  const onPlay = () => {
    if (!cast.isCasting) {
      videoRef.current?.resume();
      return;
    }
    cast.remotePlay().then((handled) => {
      if (!handled) videoRef.current?.resume();
    });
  };
  const onPause = () => {
    if (!cast.isCasting) {
      videoRef.current?.pause();
      return;
    }
    cast.remotePause().then((handled) => {
      if (!handled) videoRef.current?.pause();
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
    videoRef.current?.resume();
    setIsEnded(false);
  };

  // Memoize so rn-video doesn't see a "new" source every render and rebuffer.
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
          // Initial autoplay only — runtime play/pause uses the ref.
          paused={!autoPlay}
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
        {/* Placeholder keeps surrounding layout stable while the modal is open */}
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
    // Consumer can override via `style.height`; default to 16:9.
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
