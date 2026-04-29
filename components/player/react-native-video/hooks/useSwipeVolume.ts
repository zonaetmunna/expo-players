import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { VolumeManager } from 'react-native-volume-manager';
import { useSharedValue } from 'react-native-reanimated';
import { runOnJS } from 'react-native-worklets';

type Options = {
  layoutWidth: number;
  layoutHeight: number;
  onUpdate?: (volume: number | null) => void;
};

const supported = Platform.OS === 'ios' || Platform.OS === 'android';

/**
 * Right-side vertical swipe controls **system / media volume** (the one hardware
 * buttons control), matching YouTube / Netflix behaviour. Falls back to a no-op
 * gesture on web where react-native-volume-manager is not available.
 */
export function useSwipeVolume({ layoutWidth, layoutHeight, onUpdate }: Options) {
  const startVolume = useSharedValue(1);
  const active = useSharedValue(false);
  // Local mirror — updated synchronously after each set so consecutive drags
  // start from the most recent value without waiting for the system event round-trip.
  const lastValueRef = useRef<number>(1);

  // Seed from current system volume on mount + suppress native iOS volume HUD
  // (we render our own — avoid double overlay).
  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await VolumeManager.getVolume();
        const v = typeof r === 'number' ? r : r?.volume;
        if (!cancelled && typeof v === 'number') {
          lastValueRef.current = v;
          startVolume.value = v;
        }
      } catch {
        // ignore — first probe failure
      }
    })();
    // Hide native volume HUD on iOS so it doesn't conflict with ours
    VolumeManager.showNativeVolumeUI({ enabled: false }).catch(() => {});
    // Keep our local ref in sync if user uses hardware buttons mid-session
    const sub = VolumeManager.addVolumeListener((result) => {
      if (typeof result?.volume === 'number') {
        lastValueRef.current = result.volume;
      }
    });
    return () => {
      cancelled = true;
      sub.remove();
      // Restore native HUD when player unmounts so other apps/views aren't affected
      VolumeManager.showNativeVolumeUI({ enabled: true }).catch(() => {});
    };
  }, [startVolume]);

  if (!supported) {
    return Gesture.Pan().enabled(false);
  }

  const captureStart = () => {
    startVolume.value = lastValueRef.current;
  };

  const apply = async (v: number) => {
    const next = Math.max(0, Math.min(1, v));
    lastValueRef.current = next;
    onUpdate?.(next);
    try {
      await VolumeManager.setVolume(next, { showUI: false } as never);
    } catch {
      // ignore — set may fail if audio session not active
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
      if (e.x < layoutWidth / 2) {
        active.value = false;
        return;
      }
      active.value = true;
      runOnJS(captureStart)();
    })
    .onUpdate((e) => {
      if (!active.value) return;
      const ratio = -e.translationY / Math.max(1, layoutHeight);
      runOnJS(apply)(startVolume.value + ratio);
    })
    .onFinalize(() => {
      const wasActive = active.value;
      active.value = false;
      runOnJS(finish)(wasActive);
    });
}
