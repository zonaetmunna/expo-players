// Web stub — react-native-google-cast doesn't ship a web build, so Metro would
// crash trying to resolve native modules in the bundle. This file presents the
// same exports as its `.native.ts` sibling but with no-op behaviour.
//
// Metro auto-selects this file when bundling for web (extension priority).

import { Component, type ComponentType } from 'react';
import type { View, ViewProps } from 'react-native';

// CastButton renders nothing on web
export class CastButton extends Component<ViewProps> {
  render() {
    return null;
  }
}

// Stub enums — match the native shapes minimally
export const CastState = {
  NO_DEVICES_AVAILABLE: 'noDevicesAvailable',
  NOT_CONNECTED: 'notConnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
} as const;

export const MediaStreamType = {
  NONE: 'none',
  BUFFERED: 'buffered',
  LIVE: 'live',
} as const;

// Hooks always return null/empty on web — nothing connects, nothing renders.
export function useCastDevice(): null {
  return null;
}
export function useCastState(): null {
  return null;
}
export function useRemoteMediaClient(): null {
  return null;
}
export function useStreamPosition(): number {
  return 0;
}

// Static manager stubs
export const GoogleCast = {
  showIntroductoryOverlay: () => Promise.resolve(false),
};

// Type compatibility for View-based stubs (CastButton is rendered inline)
export type _Unused = ComponentType<View>;
