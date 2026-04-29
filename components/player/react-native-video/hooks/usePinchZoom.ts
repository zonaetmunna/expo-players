import { Gesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-worklets';

import type { ResizeMode } from '../resizeMode';

type Options = {
  resizeMode: ResizeMode;
  onChange: (next: ResizeMode) => void;
};

export function usePinchZoom({ resizeMode, onChange }: Options) {
  const handle = (scale: number) => {
    if (scale > 1.1 && resizeMode !== 'cover') {
      onChange('cover');
    } else if (scale < 0.9 && resizeMode !== 'contain') {
      onChange('contain');
    }
  };

  return Gesture.Pinch().onEnd((e) => {
    runOnJS(handle)(e.scale);
  });
}
