// Native (iOS / Android) Brightness bridge.
// Metro picks brightnessBridge.web.ts on web automatically.

export {
  getBrightnessAsync,
  PermissionStatus,
  requestPermissionsAsync,
  setBrightnessAsync,
} from 'expo-brightness';
