import { Gesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-worklets';

type ContentFit = 'contain' | 'cover' | 'fill';

type Options = {
  contentFit: ContentFit;
  onChange: (next: ContentFit) => void;
};

export function usePinchZoom({ contentFit, onChange }: Options) {
  const handle = (scale: number) => {
    if (scale > 1.1 && contentFit !== 'cover') {
      onChange('cover');
    } else if (scale < 0.9 && contentFit !== 'contain') {
      onChange('contain');
    }
  };

  return Gesture.Pinch().onEnd((e) => {
    runOnJS(handle)(e.scale);
  });
}
