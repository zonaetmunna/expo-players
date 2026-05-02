// IMA Ads helpers for react-native-video. Translates our VideoAds shape into
// rn-video's source.ad (AdConfig) prop, classifies onReceiveAdEvent payloads
// into a small set of player-facing states, and exposes platform-support helpers.
//
// Kept separate from VideoPlayer.tsx so the wiring stays focused on player
// state machine concerns and the IMA-specific knowledge lives in one file.

import { Platform } from 'react-native';
import type { AdConfig } from 'react-native-video';

import type { VideoAds } from '../../types/types';

/**
 * IMA SDK is built into rn-video on iOS + Android only. Web is not supported
 * (rn-video has no web build); on web we simply omit the ad config.
 */
export function isAdsPlatformSupported(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

/**
 * Validates the basic shape of an ads config. Returns null when valid;
 * otherwise a human-readable reason. Caller surfaces this in a banner the
 * same way DRM compat errors are surfaced.
 */
export function validateAds(ads: VideoAds): string | null {
  if (ads.type === 'csai') {
    if (typeof ads.adTagUrl !== 'string' || ads.adTagUrl.trim() === '') {
      return 'CSAI ads config missing adTagUrl';
    }
    if (!/^https?:\/\//i.test(ads.adTagUrl)) {
      return 'adTagUrl must be an http(s) URL';
    }
    return null;
  }
  if (ads.type === 'ssai') {
    if (ads.streamType === 'vod') {
      if (!ads.contentSourceId || !ads.videoId) {
        return 'SSAI VOD requires contentSourceId and videoId';
      }
    } else if (ads.streamType === 'live') {
      if (!ads.assetKey) return 'SSAI live requires assetKey';
    } else {
      return 'SSAI streamType must be "vod" or "live"';
    }
    return null;
  }
  return 'Unknown ads type';
}

/**
 * Maps our VideoAds → rn-video AdConfig. Returns undefined when ads aren't
 * supported on the current platform, the config is missing, or fails validation.
 */
export function mapAds(ads: VideoAds | undefined): AdConfig | undefined {
  if (!ads) return undefined;
  if (!isAdsPlatformSupported()) return undefined;
  if (validateAds(ads) !== null) return undefined;

  if (ads.type === 'csai') {
    return {
      type: 'csai',
      adTagUrl: ads.adTagUrl,
      // rn-video's ISO639_1 type is a literal union — cast through unknown for
      // arbitrary user-supplied values. Invalid codes silently fall back to
      // the device locale inside IMA.
      adLanguage: ads.adLanguage as AdConfig['adLanguage'],
    };
  }

  // SSAI / DAI — disjoint VOD vs Live shapes. Build each path explicitly so
  // TypeScript narrows the AdConfig union correctly.
  if (ads.streamType === 'vod') {
    return {
      type: 'ssai',
      streamType: 'vod',
      contentSourceId: ads.contentSourceId!,
      videoId: ads.videoId!,
      format: ads.format,
      adTagParameters: ads.adTagParameters,
      fallbackUri: ads.fallbackUri,
      adLanguage: ads.adLanguage as AdConfig['adLanguage'],
    };
  }

  return {
    type: 'ssai',
    streamType: 'live',
    assetKey: ads.assetKey!,
    format: ads.format,
    adTagParameters: ads.adTagParameters,
    fallbackUri: ads.fallbackUri,
    adLanguage: ads.adLanguage as AdConfig['adLanguage'],
  };
}

/**
 * Player-facing ad state. We collapse IMA's ~30 events down to the few that
 * matter for the player surface: are we in an ad break, is the ad skippable
 * yet, did all ads complete?
 */
export type AdPlayerState = {
  /** True between CONTENT_PAUSE_REQUESTED and CONTENT_RESUME_REQUESTED. */
  inAdBreak: boolean;
  /** Set when SKIPPABLE_STATE_CHANGED indicates the current ad is skippable. */
  isSkippable: boolean;
  /** Set after ALL_ADS_COMPLETED — used to suppress further ad UI. */
  allAdsCompleted: boolean;
  /** Last error message from an ad ERROR event, if any. */
  lastAdError: string | null;
};

export const INITIAL_AD_STATE: AdPlayerState = {
  inAdBreak: false,
  isSkippable: false,
  allAdsCompleted: false,
  lastAdError: null,
};

/**
 * Reducer for ad-event payloads. Pure function — easy to test, no React deps.
 *
 * IMA event names come through as strings (rn-video's WithDefault<string,...>
 * type) so we match on string values rather than importing the AdEvent enum
 * (which would couple the reducer to rn-video internals).
 */
export function reduceAdEvent(state: AdPlayerState, event: string, data?: object): AdPlayerState {
  switch (event) {
    case 'CONTENT_PAUSE_REQUESTED':
    case 'AD_BREAK_STARTED':
    case 'STARTED':
      return { ...state, inAdBreak: true };

    case 'SKIPPABLE_STATE_CHANGED':
      // IMA passes { skippable: boolean } in data on supported platforms; we
      // optimistically flag skippable on this event regardless. Players that
      // care about precise timing should listen to the raw event themselves.
      return { ...state, isSkippable: true };

    case 'CONTENT_RESUME_REQUESTED':
    case 'AD_BREAK_ENDED':
    case 'COMPLETED':
    case 'SKIPPED':
    case 'AD_PERIOD_ENDED':
      return { ...state, inAdBreak: false, isSkippable: false };

    case 'ALL_ADS_COMPLETED':
      return {
        ...state,
        inAdBreak: false,
        isSkippable: false,
        allAdsCompleted: true,
      };

    case 'ERROR': {
      const msg =
        (data as { message?: string } | undefined)?.message ??
        'Ad failed to load — continuing with content';
      return { ...state, inAdBreak: false, lastAdError: msg };
    }

    default:
      return state;
  }
}
