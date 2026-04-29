import * as Brightness from 'expo-brightness';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
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
  // Sticky failure flag — once setBrightnessAsync rejects, we stop calling onUpdate(null)
  // on every failure to avoid HUD flicker. Permission is decided by the OS at first call.
  const permissionDeniedRef = useRef<boolean>(false);
  const supported = Platform.OS === 'ios' || Platform.OS === 'android';

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    (async () => {
      try {
        const v = await Brightness.getBrightnessAsync();
        if (!cancelled) {
          lastValueRef.current = v;
          startBrightness.value = v;
        }
      } catch {
        // ignore — first probe failure shouldn't be sticky
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
    if (permissionDeniedRef.current) return;
    try {
      await Brightness.setBrightnessAsync(next);
      lastValueRef.current = next;
      onUpdate?.(next);
    } catch {
      // Lock out further attempts so we don't spam null updates
      permissionDeniedRef.current = true;
      onUpdate?.(null);
    }
  };

  const finish = (wasActive: boolean) => {
    if (wasActive) {
      onUpdate?.(null);
    }
  };

  return Gesture.Pan()
    .activeOffsetY([-12, 12])
    .failOffsetX([-20, 20])
    .onBegin((e) => {
      if (e.x >= layoutWidth / 2) {
        active.value = false;
        return;
      }
      active.value = true;
      runOnJS(captureStart)();
    })
    .onUpdate((e) => {
      if (!active.value) return;
      const ratio = -e.translationY / Math.max(1, layoutHeight);
      runOnJS(apply)(startBrightness.value + ratio);
    })
    .onFinalize(() => {
      const wasActive = active.value;
      active.value = false;
      runOnJS(finish)(wasActive);
    });
}
