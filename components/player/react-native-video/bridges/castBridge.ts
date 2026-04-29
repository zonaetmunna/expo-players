// Native (iOS / Android) Cast bridge — re-exports the real module.
// Web has a stub in castBridge.web.ts. Metro picks the right file by extension.

export {
  CastButton,
  CastState,
  MediaStreamType,
  useCastDevice,
  useCastState,
  useRemoteMediaClient,
  useStreamPosition,
} from 'react-native-google-cast';
export { default as GoogleCast } from 'react-native-google-cast';
