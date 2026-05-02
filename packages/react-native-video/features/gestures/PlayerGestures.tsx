import { Ionicons } from '@expo/vector-icons';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { ResizeMode } from '../../core/resizeMode';
import type { RnvSnapshotRef } from '../../core/useRnvPlayerSnapshot';
import { useDoubleTapSeek } from './useDoubleTapSeek';
import { useLongPressSpeed } from './useLongPressSpeed';
import { usePinchZoom } from './usePinchZoom';
import { useSwipeBrightness } from './useSwipeBrightness';
import { useSwipeSeek } from './useSwipeSeek';
import { useSwipeVolume } from './useSwipeVolume';

type Props = {
  snapshot: RnvSnapshotRef;
  isLive: boolean;
  /** When true (paused / ended / not loaded), long-press 2x is disabled */
  isPlayingState?: boolean;
  resizeMode: ResizeMode;
  onResizeModeChange: (next: ResizeMode) => void;
  seekTo: (time: number) => void;
  setRate: (r: number) => void;
  enabled?: boolean;
  children?: ReactNode;
};

type SeekFlash = { dir: 'forward' | 'backward'; seconds: number } | null;
type SeekPreview = { delta: number; targetTime: number } | null;

function formatSigned(seconds: number) {
  const abs = Math.abs(seconds);
  const m = Math.floor(abs / 60);
  const s = Math.floor(abs % 60);
  const sign = seconds >= 0 ? '+' : '−';
  return `${sign}${m}:${s.toString().padStart(2, '0')}`;
}

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function PlayerGestures({
  snapshot,
  isLive,
  isPlayingState = true,
  resizeMode,
  onResizeModeChange,
  seekTo,
  setRate,
  enabled = true,
  children,
}: Props) {
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const [seekFlash, setSeekFlash] = useState<SeekFlash>(null);
  const [seekPreview, setSeekPreview] = useState<SeekPreview>(null);
  const [boosted, setBoosted] = useState(false);
  const [zoomFlash, setZoomFlash] = useState<'cover' | 'contain' | null>(null);
  const seekFlashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoomFlashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const volumeSV = useSharedValue<number>(-1);
  const brightnessSV = useSharedValue<number>(-1);
  const [volumeText, setVolumeText] = useState<string>('');
  const [brightnessText, setBrightnessText] = useState<string>('');

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== layout.width || height !== layout.height) {
      setLayout({ width, height });
    }
  };

  const handleSeekFlash = (dir: 'forward' | 'backward', seconds: number) => {
    setSeekFlash({ dir, seconds });
    if (seekFlashTimeoutRef.current) clearTimeout(seekFlashTimeoutRef.current);
    seekFlashTimeoutRef.current = setTimeout(() => {
      setSeekFlash(null);
      seekFlashTimeoutRef.current = null;
    }, 600);
  };

  useEffect(() => {
    return () => {
      if (seekFlashTimeoutRef.current) clearTimeout(seekFlashTimeoutRef.current);
      if (zoomFlashTimeoutRef.current) clearTimeout(zoomFlashTimeoutRef.current);
    };
  }, []);

  const handleZoomChange = (next: ResizeMode) => {
    onResizeModeChange(next);
    if (next === 'cover' || next === 'contain') {
      setZoomFlash(next);
      if (zoomFlashTimeoutRef.current) clearTimeout(zoomFlashTimeoutRef.current);
      zoomFlashTimeoutRef.current = setTimeout(() => {
        setZoomFlash(null);
        zoomFlashTimeoutRef.current = null;
      }, 900);
    }
  };

  const onVolumeUpdate = (v: number | null) => {
    if (v === null) {
      volumeSV.value = withTiming(-1, { duration: 200 });
      return;
    }
    volumeSV.value = v;
    setVolumeText(`${Math.round(v * 100)}%`);
  };

  const onBrightnessUpdate = (v: number | null) => {
    if (v === null) {
      brightnessSV.value = withTiming(-1, { duration: 200 });
      return;
    }
    brightnessSV.value = v;
    setBrightnessText(`${Math.round(v * 100)}%`);
  };

  const doubleTap = useDoubleTapSeek({
    snapshot,
    seek: seekTo,
    layoutWidth: layout.width,
    isLive,
    onSeek: handleSeekFlash,
  });
  const swipeSeek = useSwipeSeek({
    snapshot,
    seek: seekTo,
    layoutWidth: layout.width,
    isLive,
    onUpdate: setSeekPreview,
  });
  const swipeVolume = useSwipeVolume({
    layoutWidth: layout.width,
    layoutHeight: layout.height,
    onUpdate: onVolumeUpdate,
  });
  const swipeBrightness = useSwipeBrightness({
    layoutWidth: layout.width,
    layoutHeight: layout.height,
    onUpdate: onBrightnessUpdate,
  });
  const pinch = usePinchZoom({ resizeMode, onChange: handleZoomChange });
  const longPress = useLongPressSpeed({
    setRate,
    // Disable when live (no rate change makes sense), or when not actually playing
    // (rate boost on a paused/ended video does nothing visible and confuses the user).
    disabled: isLive || !isPlayingState,
    onChange: setBoosted,
  });

  const composed = useMemo(
    () =>
      Gesture.Race(
        doubleTap,
        longPress,
        Gesture.Simultaneous(
          pinch,
          Gesture.Race(swipeSeek, Gesture.Simultaneous(swipeVolume, swipeBrightness))
        )
      ),
    [doubleTap, longPress, pinch, swipeSeek, swipeVolume, swipeBrightness]
  );
  const nativeGesture = useMemo(() => Gesture.Native(), []);

  const volumeHudStyle = useAnimatedStyle(() => ({
    opacity: volumeSV.value < 0 ? 0 : 1,
  }));
  const volumeBarStyle = useAnimatedStyle(() => ({
    height: `${Math.max(0, Math.min(1, volumeSV.value)) * 100}%`,
  }));
  const brightnessHudStyle = useAnimatedStyle(() => ({
    opacity: brightnessSV.value < 0 ? 0 : 1,
  }));
  const brightnessBarStyle = useAnimatedStyle(() => ({
    height: `${Math.max(0, Math.min(1, brightnessSV.value)) * 100}%`,
  }));

  if (!enabled) {
    return (
      <View style={StyleSheet.absoluteFill} onLayout={onLayout}>
        {children}
      </View>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout}>
      <GestureDetector gesture={Gesture.Simultaneous(nativeGesture, composed)}>
        <View style={StyleSheet.absoluteFill}>{children}</View>
      </GestureDetector>

      {seekFlash ? (
        <View
          pointerEvents="none"
          style={[
            styles.seekFlash,
            seekFlash.dir === 'forward' ? styles.seekFlashRight : styles.seekFlashLeft,
          ]}>
          <Ionicons
            name={seekFlash.dir === 'forward' ? 'play-forward' : 'play-back'}
            size={18}
            color="#fff"
          />
          <Text style={styles.seekFlashText}>{seekFlash.seconds}s</Text>
        </View>
      ) : null}

      {seekPreview ? (
        <View pointerEvents="none" style={styles.centerHud}>
          <Text style={styles.hudBig}>{formatTime(seekPreview.targetTime)}</Text>
          <Text style={styles.hudSmall}>{formatSigned(seekPreview.delta)}</Text>
        </View>
      ) : null}

      {zoomFlash ? (
        <View pointerEvents="none" style={styles.zoomFlash}>
          <Ionicons name={zoomFlash === 'cover' ? 'expand' : 'contract'} size={16} color="#fff" />
          <Text style={styles.zoomFlashText}>{zoomFlash === 'cover' ? 'Fill' : 'Fit'}</Text>
        </View>
      ) : null}

      <Animated.View
        pointerEvents="none"
        style={[styles.sideHud, styles.sideHudRight, volumeHudStyle]}>
        <Ionicons name="volume-high" size={22} color="#fff" />
        <View style={styles.bar}>
          <Animated.View style={[styles.barFill, volumeBarStyle]} />
        </View>
        <Text style={styles.hudSmall}>{volumeText}</Text>
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[styles.sideHud, styles.sideHudLeft, brightnessHudStyle]}>
        <Ionicons name="sunny" size={22} color="#fff" />
        <View style={styles.bar}>
          <Animated.View style={[styles.barFill, brightnessBarStyle]} />
        </View>
        <Text style={styles.hudSmall}>{brightnessText}</Text>
      </Animated.View>

      {boosted ? (
        <View pointerEvents="none" style={styles.boostedHud}>
          <Ionicons name="play-forward" size={16} color="#fff" />
          <Text style={styles.boostedText}>2x</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  seekFlash: {
    position: 'absolute',
    top: '50%',
    marginTop: -32, // half of height to vertically center
    width: 64,
    height: 64,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 32,
    gap: 2,
  },
  seekFlashLeft: { left: '15%' },
  seekFlashRight: { right: '15%' },
  seekFlashText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  zoomFlash: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -42,
    marginTop: -16,
    width: 84,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 999,
  },
  zoomFlashText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  centerHud: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hudBig: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 6,
  },
  hudSmall: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
  sideHud: {
    position: 'absolute',
    top: '20%',
    bottom: '20%',
    width: 56,
    paddingVertical: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sideHudLeft: { left: 12 },
  sideHudRight: { right: 12 },
  bar: {
    flex: 1,
    width: 6,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 3,
    overflow: 'hidden',
    marginVertical: 8,
    flexDirection: 'column-reverse',
  },
  barFill: {
    width: '100%',
    backgroundColor: '#fff',
  },
  boostedHud: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  boostedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
});
