import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, StatusBar, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Video, { type ISO639_1, type TextTrackType, type VideoRef } from 'react-native-video';
import {
  cancelDownload,
  type DownloadState,
  deleteDownload,
  downloadVideo,
  isDownloadable,
  useDownloadStatus,
} from './core/downloads';
import {
  mapAudioTrackSelection,
  mapResizeMode,
  mapTextTrackSelection,
  mapVideoTrackSelection,
} from './core/mappers';
import type { ResizeMode } from './core/resizeMode';
import { readPref, readVideo, removeVideo, writePref, writeVideo } from './core/storage';
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
  /** When true, show a download button in the top bar for downloadable sources. */
  downloadEnabled?: boolean;
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
  downloadEnabled = true,
  onRequestBack,
  style,
}: Props) {
  const videoRef = useRef<VideoRef>(null);
  const snapshot = useRnvPlayerSnapshot();
  // Safe-area insets — applied to the controls overlay in fullscreen so the
  // top icons (cast / settings / PiP / close) clear the status bar and the
  // landscape camera notch on Android.
  const insets = useSafeAreaInsets();
  // If this video has been downloaded, prefer the local file URI so it plays
  // offline. Falls through to the remote URI when not downloaded.
  const downloadStatus = useDownloadStatus(source.id);

  // No local `paused` state — runtime play/pause goes through videoRef
  // (the prop races with the media-session service).
  const [rate, setRate] = useState(1);
  const [resizeMode, setResizeMode] = useState<ResizeMode>(initialResizeMode);
  const [skin, setSkinState] = useState<SkinId>(initialSkin);
  const [isEnded, setIsEnded] = useState(false);

  // Persisted skin: load saved choice on mount, save on every change.
  // The default `initialSkin` shows for ~50ms before the stored value snaps in.
  useEffect(() => {
    let cancelled = false;
    readPref<SkinId>('skin').then((stored) => {
      if (
        !cancelled &&
        stored &&
        (stored === 'default' || stored === 'netflix' || stored === 'youtube')
      ) {
        setSkinState(stored);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const setSkin = useCallback((next: SkinId) => {
    setSkinState(next);
    writePref('skin', next);
  }, []);

  const fullscreen = useFullscreen();
  const errorMgr = usePlayerError({ drm: source.drm });
  const ads = useAdLifecycle();

  const handleEnd = useCallback(() => {
    if (!loop) {
      videoRef.current?.pause();
      setIsEnded(true);
      // Clear saved resume position on natural end so next play starts fresh.
      removeVideo(source.id, 'position');
    }
  }, [loop, source.id]);

  const events = useRnvPlayerEvents({
    snapshot,
    initialVolume,
    autoPlay,
    initialDuration: source.duration ?? 0,
    onEnd: handleEnd,
  });

  // Resume position — load saved position when the video reports loaded, then
  // periodically save current position. Cleared on natural end so a finished
  // video starts from the beginning next time.
  // Skip for live (no scrubbable timeline) and skip if the source duration is
  // unknown (we can't tell where "near the end" is).
  const sourceIdForResume = source.id;
  const isLiveForResume = !!source.isLive;
  const hasResumedRef = useRef(false);
  // Synchronous in-memory hand-off used by the fullscreen toggle to carry
  // playback position across the Modal-induced Video remount, without waiting
  // for the AsyncStorage roundtrip.
  const pendingResumeRef = useRef<number | null>(null);

  // Reset resume guard when source changes. The body reads sourceIdForResume
  // (via the log) so exhaustive-deps recognizes it as the trigger.
  useEffect(() => {
    if (__DEV__) console.log('[rn-video] resume guard reset for source', sourceIdForResume);
    hasResumedRef.current = false;
    pendingResumeRef.current = null;
  }, [sourceIdForResume]);

  // Seek to saved position once after the video reports loaded.
  // Priority: in-memory pending hand-off (fullscreen toggle) → AsyncStorage.
  useEffect(() => {
    if (isLiveForResume || hasResumedRef.current) return;
    if (!events.state.isLoaded) return;
    hasResumedRef.current = true;

    const dur = events.state.duration;

    // 1. Pending hand-off from a fullscreen toggle wins — no async wait.
    const pending = pendingResumeRef.current;
    pendingResumeRef.current = null;
    if (pending != null && pending >= 1) {
      if (!dur || pending < dur - 1) {
        videoRef.current?.seek(pending);
      }
      return;
    }

    // 2. Otherwise fall back to the persisted position from AsyncStorage.
    readVideo<number>(sourceIdForResume, 'position').then((saved) => {
      if (saved == null || saved < 5) return; // skip very-near-start saves
      if (dur && saved >= dur - 10) return; // let near-end videos play out
      videoRef.current?.seek(saved);
    });
  }, [events.state.isLoaded, events.state.duration, sourceIdForResume, isLiveForResume]);

  // Throttled position save while playing.
  const lastSaveRef = useRef(0);
  useEffect(() => {
    if (isLiveForResume) return;
    const id = setInterval(() => {
      const now = Date.now();
      if (now - lastSaveRef.current < 4000) return; // save at most every ~4s
      const t = snapshot.current.currentTime;
      if (!Number.isFinite(t) || t < 1) return;
      lastSaveRef.current = now;
      writeVideo(sourceIdForResume, 'position', t);
    }, 1000);
    return () => clearInterval(id);
  }, [sourceIdForResume, isLiveForResume, snapshot]);

  // Final save on unmount + clear when video ends naturally.
  useEffect(() => {
    return () => {
      if (isLiveForResume) return;
      const t = snapshot.current.currentTime;
      const dur = snapshot.current.duration;
      // If we're near the end, clear instead of saving (already finished).
      if (dur && t >= dur - 5) {
        removeVideo(sourceIdForResume, 'position');
        return;
      }
      if (Number.isFinite(t) && t > 1) {
        writeVideo(sourceIdForResume, 'position', t);
      }
    };
  }, [sourceIdForResume, isLiveForResume, snapshot]);

  // Surface a banner instead of handing rn-video a config it can't play.
  const compatError = useMemo(() => {
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
  }, [source.type, source.drm, source.ads]);

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
  // We deliberately depend ONLY on sourceId. errorMgr / ads come from hooks
  // whose memoized return identity changes when their internal state changes
  // (e.g. every ad event mutates `ads`). Including them in the deps would
  // make this effect re-fire on every ad event, causing a state-churn storm.
  // We capture the latest references via a ref so the closure stays current
  // without participating in the dep array.
  const resetRefsRef = useRef({ clearError: errorMgr.clearError, resetAds: ads.reset });
  resetRefsRef.current = { clearError: errorMgr.clearError, resetAds: ads.reset };

  const sourceId = source.id;
  useEffect(() => {
    if (__DEV__) console.log('[rn-video] reset for source', sourceId);
    setIsEnded(false);
    resetRefsRef.current.clearError();
    setRate(1);
    resetRefsRef.current.resetAds();
  }, [sourceId]);

  // Imperative actions — routed to cast session when active, else local.
  const seekTo = useCallback(
    (time: number) => {
      if (source.isLive) return; // live has no scrubbable timeline
      setIsEnded(false);
      cast.remoteSeek(time).then((handled) => {
        if (!handled) videoRef.current?.seek(time);
      });
    },
    [source.isLive, cast]
  );

  const setRateImperative = useCallback(
    (r: number) => {
      if (__DEV__) console.log('[rn-video] setRate called with', r, 'isCasting:', cast.isCasting);
      cast.remoteSetRate(r);
      setRate(r);
    },
    [cast]
  );

  // Imperative pause/resume — the `paused` prop loses races with the media session.
  const onPlay = useCallback(() => {
    if (!cast.isCasting) {
      videoRef.current?.resume();
      return;
    }
    cast.remotePlay().then((handled) => {
      if (!handled) videoRef.current?.resume();
    });
  }, [cast]);

  const onPause = useCallback(() => {
    if (!cast.isCasting) {
      videoRef.current?.pause();
      return;
    }
    cast.remotePause().then((handled) => {
      if (!handled) videoRef.current?.pause();
    });
  }, [cast]);

  const onRequestPiP = useCallback(() => {
    try {
      videoRef.current?.enterPictureInPicture();
    } catch {
      // ignore
    }
  }, []);

  const onReplay = useCallback(() => {
    videoRef.current?.seek(0);
    videoRef.current?.resume();
    setIsEnded(false);
  }, []);

  // Download button handler — switches behavior based on current state.
  // The button only appears in the skin when downloadEnabled && isDownloadable
  // (gated below in the prop pass-through), so handlers don't need to recheck.
  const onToggleDownload = useCallback(() => {
    const state: DownloadState = downloadStatus.state;
    if (state === 'idle' || state === 'error' || state === 'cancelled') {
      downloadVideo({
        id: source.id,
        uri: source.uri,
        title: source.title,
        poster: source.poster,
        durationSec: source.duration,
      });
    } else if (state === 'downloading') {
      cancelDownload(source.id);
    } else if (state === 'done') {
      deleteDownload(source.id);
    }
  }, [downloadStatus.state, source.id, source.uri, source.title, source.poster, source.duration]);

  const handleToggleFullscreen = useCallback(async () => {
    if (!isLiveForResume) {
      const t = snapshot.current.currentTime;
      if (Number.isFinite(t) && t >= 1) {
        pendingResumeRef.current = t;
        hasResumedRef.current = false;
        events.setState((s) => ({ ...s, isLoaded: false }));
      }
    }
    await fullscreen.toggle();
  }, [fullscreen, isLiveForResume, snapshot, events]);

  // Memoize so rn-video doesn't see a "new" source every render and rebuffer.
  const videoSource = useMemo(() => {
    const mappedAd = mapAds(source.ads);
    if (__DEV__ && source.ads) {
      console.log('[rn-video] ads config attached to source', {
        title: source.title,
        rawAds: source.ads,
        mappedAd,
      });
    }
    // Prefer the locally-downloaded file when available so the video plays
    // offline. Falls through to the remote URL otherwise.
    const effectiveUri =
      downloadStatus.state === 'done' && downloadStatus.localUri
        ? downloadStatus.localUri
        : source.uri;
    return {
      uri: effectiveUri,
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
  }, [
    source.uri,
    source.drm,
    source.ads,
    source.subtitles,
    source.title,
    source.description,
    source.poster,
    downloadStatus.state,
    downloadStatus.localUri,
  ]);

  // Memoize enum mapper outputs so they don't allocate fresh objects every
  // render — rn-video diffs these props by identity.
  const rnvResizeMode = useMemo(() => mapResizeMode(resizeMode), [resizeMode]);
  const rnvVideoTrack = useMemo(
    () => mapVideoTrackSelection(events.state.selectedVideoTrack),
    [events.state.selectedVideoTrack]
  );
  const rnvAudioTrack = useMemo(
    () => mapAudioTrackSelection(events.state.selectedAudioTrack),
    [events.state.selectedAudioTrack]
  );
  const rnvTextTrack = useMemo(
    () => mapTextTrackSelection(events.state.selectedTextTrack),
    [events.state.selectedTextTrack]
  );

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
          resizeMode={rnvResizeMode}
          selectedVideoTrack={rnvVideoTrack}
          selectedAudioTrack={rnvAudioTrack}
          selectedTextTrack={rnvTextTrack}
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

      <View
        pointerEvents="box-none"
        style={
          fullscreen.isFullscreen
            ? [
                StyleSheet.absoluteFill,
                {
                  paddingTop: insets.top,
                  paddingBottom: insets.bottom,
                  paddingLeft: insets.left,
                  paddingRight: insets.right,
                },
              ]
            : StyleSheet.absoluteFill
        }>
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
          canDownload={downloadEnabled && isDownloadable(source)}
          downloadState={downloadStatus.state}
          downloadProgress={downloadStatus.progress}
          onToggleDownload={onToggleDownload}
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
          onToggleFullscreen={handleToggleFullscreen}
          onRequestPiP={onRequestPiP}
          onRetry={errorMgr.onRetry}
          onRequestBack={fullscreen.isFullscreen ? handleToggleFullscreen : onRequestBack}
        />
      </View>
    </View>
  );

  if (fullscreen.isFullscreen) {
    return (
      <>
        <View style={[styles.inlineContainer, style]} />
        <Modal
          visible
          animationType="fade"
          supportedOrientations={['landscape', 'portrait']}
          onRequestClose={handleToggleFullscreen}
          statusBarTranslucent
          navigationBarTranslucent>
          <StatusBar hidden translucent />
          <GestureHandlerRootView style={styles.fullscreenContainer}>
            {playerBody}
          </GestureHandlerRootView>
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
