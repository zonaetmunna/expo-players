import { useCallback, useMemo, useState } from 'react';
import type { OnReceiveAdEventData } from 'react-native-video';

import { type AdPlayerState, INITIAL_AD_STATE, reduceAdEvent } from './ads';

export type AdLifecycle = {
  adState: AdPlayerState;
  reset: () => void;
  handleAdEvent: (e: OnReceiveAdEventData) => void;
};

export function useAdLifecycle(): AdLifecycle {
  const [adState, setAdState] = useState<AdPlayerState>(INITIAL_AD_STATE);

  const handleAdEvent = useCallback((e: OnReceiveAdEventData) => {
    const eventName = e?.event ?? 'UNKNOWN';
    setAdState((prev) => reduceAdEvent(prev, eventName, e?.data));
  }, []);

  const reset = useCallback(() => {
    setAdState(INITIAL_AD_STATE);
  }, []);

  return useMemo(() => ({ adState, reset, handleAdEvent }), [adState, reset, handleAdEvent]);
}
