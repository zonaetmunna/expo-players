// Owns fullscreen state + landscape orientation lock + status-bar visibility.
// On Android, expo-status-bar inside a Modal is unreliable — we drive the
// status bar imperatively from this hook so it works regardless of where
// the player is mounted in the React tree.

import * as ScreenOrientation from 'expo-screen-orientation';
import { useCallback, useEffect, useState } from 'react';
import { Platform, StatusBar } from 'react-native';

export type Fullscreen = {
  isFullscreen: boolean;
  toggle: () => Promise<void>;
};

export function useFullscreen(): Fullscreen {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Reset to portrait + restore status bar on unmount so the rest of the
  // app isn't left in a rotated state.
  useEffect(() => {
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      StatusBar.setHidden(false, 'fade');
      if (Platform.OS === 'android') {
        StatusBar.setTranslucent(false);
      }
    };
  }, []);

  // Keep the status bar in sync with `isFullscreen`. Imperative because
  // <StatusBar /> components inside a Modal are unreliable on Android.
  useEffect(() => {
    if (isFullscreen) {
      StatusBar.setHidden(true, 'fade');
      if (Platform.OS === 'android') {
        StatusBar.setTranslucent(true);
      }
    } else {
      StatusBar.setHidden(false, 'fade');
      if (Platform.OS === 'android') {
        StatusBar.setTranslucent(false);
      }
    }
  }, [isFullscreen]);

  const toggle = useCallback(async () => {
    try {
      if (isFullscreen) {
        // Re-lock to portrait when leaving fullscreen so the app returns to
        // its normal orientation regardless of how the phone is being held.
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        setIsFullscreen(false);
      } else {
        // Unlock so the OS rotation-lock setting is respected:
        //   - lock OFF → fullscreen rotates to match physical orientation
        //   - lock ON  → fullscreen stays in user's locked orientation
        // This matches YouTube / Netflix native behavior.
        await ScreenOrientation.unlockAsync();
        setIsFullscreen(true);
      }
    } catch {
      // ignore — orientation lock denied (rare; some Android OEMs)
    }
  }, [isFullscreen]);

  return { isFullscreen, toggle };
}
