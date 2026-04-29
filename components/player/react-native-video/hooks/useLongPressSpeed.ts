import { useMemo, useRef } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';

type Options = {
  setRate: (r: number) => void;
  boostedRate?: number;
  /** Disable the gesture (e.g. for live streams or when not actively playing) */
  disabled?: boolean;
  onChange?: (boosted: boolean) => void;
};

export function useLongPressSpeed({
  setRate,
  boostedRate = 2,
  disabled = false,
  onChange,
}: Options) {
  const optsRef = useRef({ setRate, boostedRate, onChange });
  optsRef.current = { setRate, boostedRate, onChange };

  return useMemo(() => {
    const start = () => {
      const o = optsRef.current;
      o.setRate(o.boostedRate);
      o.onChange?.(true);
    };
    const stop = () => {
      const o = optsRef.current;
      o.setRate(1);
      o.onChange?.(false);
    };

    return Gesture.LongPress()
      .minDuration(350)
      .enabled(!disabled)
      .onStart(() => {
        scheduleOnRN(start);
      })
      .onFinalize(() => {
        scheduleOnRN(stop);
      });
  }, [disabled]);
}
