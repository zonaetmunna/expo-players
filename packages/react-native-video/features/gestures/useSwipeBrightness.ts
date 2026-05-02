import { useEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import {
  getBrightnessAsync,
  requestPermissionsAsync,
  setBrightnessAsync,
} from './bridges/brightnessBridge';

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
      // On Android, system-brightness writes need WRITE_SETTINGS. App-brightness
      // (which expo-brightness uses by default) does not — but requesting first
      // avoids a silent failure on the first gesture frame.
      if (Platform.OS === 'android') {
        try {
          await requestPermissionsAsync();
        } catch {
          // permission may already be granted, or user dismissed — proceed anyway
        }
      }
      try {
        const v = await getBrightnessAsync();
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

  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  return useMemo(() => {
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
        await setBrightnessAsync(next);
        lastValueRef.current = next;
        onUpdateRef.current?.(next);
      } catch {
        permissionDeniedRef.current = true;
        onUpdateRef.current?.(null);
      }
    };

    const finish = (wasActive: boolean) => {
      if (wasActive) {
        onUpdateRef.current?.(null);
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
        scheduleOnRN(captureStart);
      })
      .onUpdate((e) => {
        if (!active.value) return;
        const ratio = -e.translationY / Math.max(1, layoutHeight);
        scheduleOnRN(apply, startBrightness.value + ratio);
      })
      .onFinalize(() => {
        const wasActive = active.value;
        active.value = false;
        scheduleOnRN(finish, wasActive);
      });
  }, [layoutWidth, layoutHeight, startBrightness, active, supported]);
}
