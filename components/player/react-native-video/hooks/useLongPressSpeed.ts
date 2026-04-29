import { Gesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-worklets';

type Options = {
  setRate: (r: number) => void;
  boostedRate?: number;
  /** Disable the gesture (e.g. for live streams where rate change pulls off live edge) */
  disabled?: boolean;
  onChange?: (boosted: boolean) => void;
};

export function useLongPressSpeed({
  setRate,
  boostedRate = 2,
  disabled = false,
  onChange,
}: Options) {
  const start = () => {
    setRate(boostedRate);
    onChange?.(true);
  };
  const stop = () => {
    setRate(1);
    onChange?.(false);
  };

  return Gesture.LongPress()
    .minDuration(350)
    .enabled(!disabled)
    .onStart(() => {
      runOnJS(start)();
    })
    .onFinalize(() => {
      runOnJS(stop)();
    });
}
