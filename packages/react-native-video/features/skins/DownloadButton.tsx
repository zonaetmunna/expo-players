// Shared download button used by all three skins. One file, one component —
// keeps the icon, the progress ring, the pending spinner, and the press
// behavior in sync across Default / Netflix / YouTube skins.
//
// Visual states:
//   idle         → cloud-download-outline                (tap: start)
//   pending      → spinner ring around cloud icon        (tap: cancel)
//                  (downloading but no progress reported yet — HLS before
//                   the first segment lands, or MP4 before Content-Length)
//   downloading  → progress ring around close (X)        (tap: cancel)
//                  with a tiny % badge in the corner
//   done         → checkmark-circle (accent color)       (tap: delete)
//   error        → alert-circle-outline                  (tap: retry)
//
// Progress ring uses two rotating half-disks — no SVG dep, works on RN paper
// and new arch. Standard "CSS pie chart" pattern adapted to RN.

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import type { DownloadState } from '../downloads';

type Props = {
  state: DownloadState;
  /** 0..1 when known. Undefined while pending (no progress reported yet). */
  progress?: number;
  /** Color of the ring + done check. Skin-specific (red on Netflix/YouTube). */
  accentColor: string;
  iconSize?: number;
  /** Outer hit/visual size. Matches skin's iconBtn (36 default, 38 on Netflix). */
  size?: number;
  onPress?: () => void;
};

export function DownloadButton({
  state,
  progress,
  accentColor,
  iconSize = 20,
  size = 36,
  onPress,
}: Props) {
  const isDownloading = state === 'downloading';
  // Pending = downloading kicked off but we don't have a real progress number
  // yet. HLS does this for a beat between "task started" and "first segment
  // landed". Show an indeterminate spinning ring instead of a stuck 0%.
  const hasProgress = typeof progress === 'number' && progress > 0;

  const iconName: React.ComponentProps<typeof Ionicons>['name'] =
    state === 'done'
      ? 'checkmark-circle'
      : state === 'error'
        ? 'alert-circle-outline'
        : isDownloading
          ? 'close'
          : 'cloud-download-outline';

  const iconColor = state === 'done' ? accentColor : '#fff';

  const a11yLabel =
    state === 'done'
      ? 'Delete downloaded video'
      : state === 'error'
        ? 'Retry download'
        : isDownloading
          ? 'Cancel download'
          : 'Download for offline';

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={[styles.btn, { width: size, height: size, borderRadius: size / 2 }]}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}>
      {isDownloading ? (
        hasProgress ? (
          <ProgressRing size={size - 4} progress={progress as number} color={accentColor} />
        ) : (
          <SpinnerRing size={size - 4} color={accentColor} />
        )
      ) : null}
      <Ionicons name={iconName} size={iconSize} color={iconColor} />
    </Pressable>
  );
}

// Continuously-spinning quarter-arc. Used while we wait for the first real
// progress event (HLS before the first segment lands, or MP4 before the
// Content-Length header confirms total bytes).
function SpinnerRing({ size, color }: { size: number; color: string }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <View style={[styles.ringWrap, { width: size, height: size }]} pointerEvents="none">
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: 'rgba(255,255,255,0.25)',
        }}
      />
      <Animated.View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderTopColor: color,
          borderRightColor: color,
          borderBottomColor: 'transparent',
          borderLeftColor: 'transparent',
          transform: [{ rotate }],
        }}
      />
    </View>
  );
}

// Determinate progress ring drawn with two rotating half-disks behind a
// circular mask. The trick:
//   - draw a faint full-circle "track"
//   - on top, draw two semicircle "fills" using a rectangle clipped to half
//     the circle by an `overflow:hidden` parent
//   - the right half rotates 0..180° as progress goes 0..50%
//   - past 50%, the right half stays at 180° and the left half rotates
//     0..180° to fill the remainder
function ProgressRing({
  size,
  progress,
  color,
}: {
  size: number;
  progress: number;
  color: string;
}) {
  const clamped = Math.max(0, Math.min(1, progress));
  const rightDeg = Math.min(0.5, clamped) * 360;
  const leftDeg = Math.max(0, clamped - 0.5) * 360;

  return (
    <View style={[styles.ringWrap, { width: size, height: size }]} pointerEvents="none">
      {/* Track */}
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: 'rgba(255,255,255,0.25)',
        }}
      />
      {/* Right half — clip to right semicircle, then rotate inner disk */}
      <RingHalf size={size} side="right" color={color} rotateDeg={rightDeg} />
      {/* Left half — only visible past 50% */}
      {leftDeg > 0 ? (
        <RingHalf size={size} side="left" color={color} rotateDeg={leftDeg} />
      ) : null}
    </View>
  );
}

function RingHalf({
  size,
  side,
  color,
  rotateDeg,
}: {
  size: number;
  side: 'left' | 'right';
  color: string;
  rotateDeg: number;
}) {
  // The OUTER View is a half-rectangle clipping window — it shows only the
  // requested half of the inner ring. The INNER View is a full bordered
  // circle whose border on the visible side draws the arc.
  //
  // Each half has a "starting edge" (the diameter line). For the right side,
  // rotation 0° = vertical diameter (no fill). For the left side, rotation
  // 0° corresponds to having already swept the right half (180° baseline).
  return (
    <View
      style={{
        position: 'absolute',
        width: size / 2,
        height: size,
        overflow: 'hidden',
        left: side === 'right' ? size / 2 : 0,
      }}>
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: 'transparent',
          borderTopColor: color,
          borderRightColor: color,
          left: side === 'right' ? -size / 2 : 0,
          transform: [
            { rotate: `${side === 'right' ? rotateDeg - 90 : rotateDeg + 90}deg` },
          ],
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },

});
