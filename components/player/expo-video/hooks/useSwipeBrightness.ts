import * as Brightness from 'expo-brightness';
import { useEffect, useRef } from 'react';
import { Dimensions, Platform } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { runOnJS } from 'react-native-worklets';

type Options = {
  layoutWidth: number;
  layoutHeight: number;
  onUpdate?: (brightness: number | null) => void;
};

export function useSwipeBrightness({ layoutWidth, layoutHeight, onUpdate }: Options) {
  const startBrightness = useSharedValue(0.5);
  const active = useSharedValue(false);
  const lastValueRef = useRef<number>(0.5);
  const supported = Platform.OS === 'ios' || Platform.OS === 'android';
  const fallbackWindow = Dimensions.get('window');
  const effectiveWidth = layoutWidth > 0 ? layoutWidth : fallbackWindow.width;
  const effectiveHeight = layoutHeight > 0 ? layoutHeight : fallbackWindow.height;

  // Seed from current brightness on mount (best-effort)
  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    (async () => {
      try {
        if (Platform.OS === 'android') {
          await Brightness.requestPermissionsAsync();
        }
        const v = await Brightness.getBrightnessAsync();
        if (!cancelled) {
          lastValueRef.current = v;
          startBrightness.value = v;
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supported, startBrightness]);

  if (!supported) {
    return Gesture.Pan().enabled(false);
  }

  const captureStart = () => {
    startBrightness.value = lastValueRef.current;
  };

  const apply = async (v: number) => {
    const next = Math.max(0, Math.min(1, v));
    try {
      await Brightness.setBrightnessAsync(next);
      lastValueRef.current = next;
      onUpdate?.(next);
    } catch {
      onUpdate?.(null);
    }
  };

  const clear = () => onUpdate?.(null);

  return Gesture.Pan()
    .activeOffsetY([-12, 12])
    .failOffsetX([-20, 20])
    .onBegin((e) => {
      if (e.x >= effectiveWidth / 2) {
        active.value = false;
        return;
      }
      active.value = true;
      runOnJS(captureStart)();
    })
    .onUpdate((e) => {
      if (!active.value) return;
      const ratio = -e.translationY / Math.max(1, effectiveHeight);
      runOnJS(apply)(startBrightness.value + ratio);
    })
    .onFinalize(() => {
      active.value = false;
      runOnJS(clear)();
    });
}
