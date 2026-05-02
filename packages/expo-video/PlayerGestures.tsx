import { Ionicons } from '@expo/vector-icons';
import type { VideoContentFit, VideoPlayer } from 'expo-video';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useDoubleTapSeek } from './hooks/useDoubleTapSeek';
import { useLongPressSpeed } from './hooks/useLongPressSpeed';
import { usePinchZoom } from './hooks/usePinchZoom';
import { useSwipeBrightness } from './hooks/useSwipeBrightness';
import { useSwipeSeek } from './hooks/useSwipeSeek';
import { useSwipeVolume } from './hooks/useSwipeVolume';
import type { PlayerSnapshotRef } from './hooks/usePlayerSnapshot';

type Props = {
  player: VideoPlayer;
  snapshot: PlayerSnapshotRef;
  contentFit: VideoContentFit;
  onContentFitChange: (next: VideoContentFit) => void;
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
  player,
  snapshot,
  contentFit,
  onContentFitChange,
  enabled = true,
  children,
}: Props) {
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const [seekFlash, setSeekFlash] = useState<SeekFlash>(null);
  const [seekPreview, setSeekPreview] = useState<SeekPreview>(null);
  const [boosted, setBoosted] = useState(false);
  const seekFlashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // HUD values driven by shared values to avoid React re-renders during gestures
  const volumeSV = useSharedValue<number>(-1); // -1 = hidden
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
    };
  }, []);

  // Volume HUD: shared value drives opacity + bar height; text updates throttled via JS
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
    player,
    snapshot,
    layoutWidth: layout.width,
    onSeek: handleSeekFlash,
  });
  const swipeSeek = useSwipeSeek({
    player,
    snapshot,
    layoutWidth: layout.width,
    onUpdate: setSeekPreview,
  });
  const swipeVolume = useSwipeVolume({
    player,
    snapshot,
    layoutWidth: layout.width,
    layoutHeight: layout.height,
    onUpdate: onVolumeUpdate,
  });
  const swipeBrightness = useSwipeBrightness({
    layoutWidth: layout.width,
    layoutHeight: layout.height,
    onUpdate: onBrightnessUpdate,
  });
  const pinch = usePinchZoom({ contentFit, onChange: onContentFitChange });
  const longPress = useLongPressSpeed({ player, snapshot, onChange: setBoosted });

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

  const volumeHudStyle = useAnimatedStyle(() => {
    const v = volumeSV.value;
    return {
      opacity: v < 0 ? 0 : 1,
    };
  });
  const volumeBarStyle = useAnimatedStyle(() => {
    const v = volumeSV.value;
    return {
      height: `${Math.max(0, Math.min(1, v)) * 100}%`,
    };
  });

  const brightnessHudStyle = useAnimatedStyle(() => {
    const v = brightnessSV.value;
    return { opacity: v < 0 ? 0 : 1 };
  });
  const brightnessBarStyle = useAnimatedStyle(() => {
    const v = brightnessSV.value;
    return { height: `${Math.max(0, Math.min(1, v)) * 100}%` };
  });

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
            size={28}
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
    top: '40%',
    width: '40%',
    paddingVertical: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  seekFlashLeft: {
    left: '5%',
  },
  seekFlashRight: {
    right: '5%',
  },
  seekFlashText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  centerHud: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
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
  sideHudLeft: {
    left: 12,
  },
  sideHudRight: {
    right: 12,
  },
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
