// Native (iOS / Android) Brightness bridge.
// Metro picks brightnessBridge.web.ts on web automatically.

export {
  getBrightnessAsync,
  setBrightnessAsync,
  requestPermissionsAsync,
  PermissionStatus,
} from 'expo-brightness';
