import '../global.css';
import 'expo-dev-client';

import { ActionSheetProvider } from '@expo/react-native-action-sheet';
import { ThemeProvider as NavThemeProvider } from '@react-navigation/native';

import { setAudioModeAsync } from 'expo-audio';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeToggle } from '@/components/nativewindui/ThemeToggle';
import { useColorScheme } from '@/lib/useColorScheme';
import { GoogleCast } from '@/packages/react-native-video/features/cast/bridges/castBridge';
import { NAV_THEME } from '@/theme';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export default function RootLayout() {
  const { colorScheme, isDarkColorScheme } = useColorScheme();

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'duckOthers',
      allowsRecording: false,
      shouldRouteThroughEarpiece: false,
    }).catch(() => {});

    // Cast SDK initializes itself via the native plugin. On iOS, Apple requires showing
    // a one-time introductory overlay the first time the user sees the Cast button —
    // we schedule it once on first mount; the library tracks the "already shown" state.
    GoogleCast.showIntroductoryOverlay().catch(() => {
      // ignore — happens when no Cast button is currently rendered or on Android
    });
  }, []);

  return (
    <>
      <StatusBar
        key={`root-status-bar-${isDarkColorScheme ? 'light' : 'dark'}`}
        style={isDarkColorScheme ? 'light' : 'dark'}
      />
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <ActionSheetProvider>
            <NavThemeProvider value={NAV_THEME[colorScheme]}>
              <Stack screenOptions={SCREEN_OPTIONS}>
                <Stack.Screen name="(drawer)" options={DRAWER_OPTIONS} />
                <Stack.Screen name="video/[id]" options={VIDEO_OPTIONS} />
                <Stack.Screen name="video-rnv/[id]" options={VIDEO_OPTIONS} />
                <Stack.Screen name="audio/[id]" options={AUDIO_OPTIONS} />
                <Stack.Screen name="modal" options={MODAL_OPTIONS} />
              </Stack>
            </NavThemeProvider>
          </ActionSheetProvider>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </>
  );
}

const SCREEN_OPTIONS = {
  animation: 'ios_from_right', // for android
} as const;

const DRAWER_OPTIONS = {
  headerShown: false,
} as const;

const VIDEO_OPTIONS = {
  headerShown: true,
  title: 'Player',
  headerBackTitle: 'Back',
  headerLargeTitle: false,
  headerTitleStyle: { fontWeight: '700' as const },
} as const;

const AUDIO_OPTIONS = {
  headerShown: true,
  title: 'Now Playing',
  headerBackTitle: 'Back',
  headerLargeTitle: false,
  headerTitleStyle: { fontWeight: '700' as const },
} as const;

const MODAL_OPTIONS = {
  presentation: 'modal',
  animation: 'fade_from_bottom', // for android
  title: 'Settings',
  headerRight: () => <ThemeToggle />,
} as const;
