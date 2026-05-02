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

  // Reset orientation + restore status bar on unmount so the rest of the
  // app isn't left in landscape / hidden-status-bar state.
  useEffect(() => {
    return () => {
      ScreenOrientation.unlockAsync().catch(() => {});
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
        await ScreenOrientation.unlockAsync();
        setIsFullscreen(false);
      } else {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        setIsFullscreen(true);
      }
    } catch {
      // ignore — orientation lock denied (rare; some Android OEMs)
    }
  }, [isFullscreen]);

  return { isFullscreen, toggle };
}
