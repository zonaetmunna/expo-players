// Tracks IMA ad lifecycle. The IMA SDK draws its own skip button / countdown
// / click-through chrome natively over the Video surface during ad breaks;
// this hook just tracks the state machine so our skin can hide its own
// chrome (which would otherwise paint on top of IMA's UI).
//
// Events come through rn-video's onReceiveAdEvent and get reduced into a
// small player-facing state by `reduceAdEvent` in ../ads.ts.

import { useCallback, useState } from 'react';
import type { OnReceiveAdEventData } from 'react-native-video';

import { INITIAL_AD_STATE, reduceAdEvent, type AdPlayerState } from '../ads';

export type AdLifecycle = {
  /** Current ad state — `inAdBreak` is what skins read to hide chrome. */
  adState: AdPlayerState;
  /** Reset to initial — call this when the source changes. */
  reset: () => void;
  /** Wire to <Video onReceiveAdEvent>. */
  handleAdEvent: (e: OnReceiveAdEventData) => void;
};

export function useAdLifecycle(): AdLifecycle {
  const [adState, setAdState] = useState<AdPlayerState>(INITIAL_AD_STATE);

  const handleAdEvent = useCallback((e: OnReceiveAdEventData) => {
    const eventName = e?.event ?? 'UNKNOWN';
    // eslint-disable-next-line no-console
    console.log('[rn-video] onReceiveAdEvent', eventName, e?.data);
    setAdState((prev) => reduceAdEvent(prev, eventName, e?.data));
  }, []);

  const reset = useCallback(() => {
    setAdState(INITIAL_AD_STATE);
  }, []);

  return { adState, reset, handleAdEvent };
}
