import { useMemo, useRef } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';

import type { ResizeMode } from '../resizeMode';

type Options = {
  resizeMode: ResizeMode;
  onChange: (next: ResizeMode) => void;
};

export function usePinchZoom({ resizeMode, onChange }: Options) {
  const optsRef = useRef({ resizeMode, onChange });
  optsRef.current = { resizeMode, onChange };

  return useMemo(() => {
    const handle = (scale: number) => {
      const o = optsRef.current;
      if (scale > 1.1 && o.resizeMode !== 'cover') {
        o.onChange('cover');
      } else if (scale < 0.9 && o.resizeMode !== 'contain') {
        o.onChange('contain');
      }
    };

    return Gesture.Pinch().onEnd((e) => {
      scheduleOnRN(handle, e.scale);
    });
  }, []);
}
