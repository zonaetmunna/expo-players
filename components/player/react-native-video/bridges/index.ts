// Re-export the platform-resolved bridges so consumers can do:
//   import { CastButton, VolumeManager, getBrightnessAsync } from './bridges';
// and Metro picks the correct platform implementation automatically.

export * from './castBridge';
export * from './volumeBridge';
export * from './brightnessBridge';
