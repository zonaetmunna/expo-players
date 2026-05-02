// DRM helpers for the react-native-video player. Translates our normalized
// VideoDRM shape into the rn-video Drm prop, validates platform support, and
// produces user-facing error messages from rn-video's onError payload.
//
// Kept separate from VideoPlayer.tsx so the mapping logic can be unit-tested
// and reused (e.g. by a future audio-DRM player) without dragging in the whole
// player component tree.

import { Platform } from 'react-native';
import { DRMType, type Drm } from 'react-native-video';

import type { DRMScheme, VideoDRM } from '../../types/types';

/** Fields rn-video's onError payload may include — varies per platform. */
type RnvErrorShape = {
  errorString?: string;
  localizedDescription?: string;
  localizedFailureReason?: string;
  errorCode?: number | string;
  code?: number | string;
  domain?: string;
};

const DRM_TYPE_MAP: Record<DRMScheme, DRMType> = {
  widevine: DRMType.WIDEVINE,
  fairplay: DRMType.FAIRPLAY,
  playready: DRMType.PLAYREADY,
  clearkey: DRMType.CLEARKEY,
};

/**
 * Returns true when this DRM scheme can play on the current platform.
 * On unsupported platforms we surface a clear error instead of letting rn-video
 * fail with an opaque native exception.
 */
export function isDrmSchemeSupported(scheme: DRMScheme): boolean {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'ios') return scheme === 'fairplay';
  if (Platform.OS === 'android') {
    return scheme === 'widevine' || scheme === 'playready' || scheme === 'clearkey';
  }
  return false;
}

/**
 * Validates the DRM config has the minimum fields required to attempt playback.
 * Returns null when valid; otherwise a human-readable reason.
 */
export function validateDrm(drm: VideoDRM): string | null {
  if (!DRM_TYPE_MAP[drm.type]) {
    return `Unknown DRM scheme: ${drm.type}`;
  }
  // Either a license server URL or a getLicense callback must be present.
  const hasServer = typeof drm.licenseServer === 'string' && drm.licenseServer.trim() !== '';
  const hasCallback = typeof drm.getLicense === 'function';
  if (!hasServer && !hasCallback) {
    return 'DRM config missing both licenseServer and getLicense';
  }
  if (hasServer && !/^https?:\/\//i.test(drm.licenseServer!)) {
    return 'DRM licenseServer must be an http(s) URL';
  }
  if (drm.type === 'fairplay' && !drm.certificateUrl && !drm.getLicense) {
    return 'FairPlay requires either certificateUrl or a getLicense callback';
  }
  return null;
}

/**
 * Maps our VideoDRM into rn-video's Drm prop shape. Returns undefined when the
 * input is null/undefined or fails validation — caller can use the validation
 * helpers above to surface a specific error.
 */
export function mapDrm(drm: VideoDRM | undefined): Drm | undefined {
  if (!drm) return undefined;
  if (validateDrm(drm) !== null) return undefined;
  if (!isDrmSchemeSupported(drm.type)) return undefined;

  return {
    type: DRM_TYPE_MAP[drm.type],
    licenseServer: drm.licenseServer,
    headers: drm.headers,
    contentId: drm.contentId,
    certificateUrl: drm.certificateUrl,
    base64Certificate: drm.base64Certificate,
    multiDrm: drm.multiDrm,
    getLicense: drm.getLicense,
  };
}

/**
 * Inspects a raw rn-video error payload and returns a DRM-specific message
 * if it looks like a license/key/scheme failure. Returns null when the error
 * doesn't match a known DRM signature — caller should fall back to its
 * generic error formatter.
 *
 * Platform-specific signatures:
 *   - Android (ExoPlayer): `MediaDrmCallbackException`, `KeysExpiredException`,
 *       `UnsupportedDrmException`, `DrmSession` errors, HTTP 4xx/5xx in domain
 *   - iOS (AVFoundation): domain `AVFoundationErrorDomain` with codes -11800,
 *       -11829 (FairPlay-related), or messages mentioning "key", "license",
 *       "AVContentKey"
 */
export function describeDrmError(raw: unknown): string | null {
  const err = ((raw as { error?: unknown })?.error ?? raw) as RnvErrorShape | undefined;
  if (!err || typeof err !== 'object') return null;

  const haystack = [
    err.errorString,
    err.localizedDescription,
    err.localizedFailureReason,
    err.domain,
    String(err.errorCode ?? ''),
    String(err.code ?? ''),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (!haystack) return null;

  // Ordered most-specific → most-generic so the first hit wins.
  if (/keys?\s?expired|expired\s?keys?/.test(haystack)) {
    return 'DRM license expired. Try again or sign in to refresh access.';
  }
  if (/unsupporteddrm|unsupported\s?drm|no\s?supported\s?drm/.test(haystack)) {
    return 'This device does not support the DRM scheme required by this stream.';
  }
  if (/avcontentkey|fairplay|spc\b|ckc\b/.test(haystack)) {
    return 'FairPlay license request failed. The certificate or license server may be unreachable.';
  }
  if (/mediadrm|drmsession|widevine/.test(haystack)) {
    return 'Widevine license request failed. The license server may be unreachable or rejected this device.';
  }
  if (/license|provisioning|provision/.test(haystack)) {
    return 'DRM license request failed. The license server returned an error.';
  }
  if (/playready/.test(haystack)) {
    return 'PlayReady license request failed.';
  }
  if (/clearkey/.test(haystack)) {
    return 'ClearKey decryption failed.';
  }
  return null;
}
