// Shared scrubber + sprite-thumbnail bubble. Each skin styles the surrounding
// chrome differently but the scrubber mechanics are identical.

import Slider from '@react-native-community/slider';
import { useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import type { SpriteCue } from '../hooks/useSpriteThumbnails';
import { SpriteThumbnail } from '../SpriteThumbnail';

const SPRITE_BUBBLE_MIN = 96;
const SPRITE_BUBBLE_MAX = 200;
const SPRITE_BUBBLE_RATIO = 0.42;

function computeBubbleWidth(sliderWidth: number) {
  if (sliderWidth <= 0) return SPRITE_BUBBLE_MIN;
  return Math.round(
    Math.max(SPRITE_BUBBLE_MIN, Math.min(SPRITE_BUBBLE_MAX, sliderWidth * SPRITE_BUBBLE_RATIO))
  );
}

function formatTime(seconds: number) {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

type Props = {
  duration: number;
  value: number;
  scrubValue: number;
  scrubbing: boolean;
  spriteCue: SpriteCue | null;
  disabled: boolean;
  minimumTrackTintColor: string;
  maximumTrackTintColor: string;
  thumbTintColor: string;
  onSlidingStart: () => void;
  onValueChange: (value: number) => void;
  onSlidingComplete: (value: number) => void;
};

export function SkinScrubber({
  duration,
  value,
  scrubValue,
  scrubbing,
  spriteCue,
  disabled,
  minimumTrackTintColor,
  maximumTrackTintColor,
  thumbTintColor,
  onSlidingStart,
  onValueChange,
  onSlidingComplete,
}: Props) {
  const [sliderWidth, setSliderWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => {
    setSliderWidth(e.nativeEvent.layout.width);
  };

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      {spriteCue && sliderWidth > 0 && scrubbing
        ? (() => {
            const bubbleWidth = computeBubbleWidth(sliderWidth);
            return (
              <View
                pointerEvents="none"
                style={[
                  styles.bubble,
                  {
                    left: Math.max(
                      0,
                      Math.min(
                        sliderWidth - bubbleWidth,
                        (scrubValue / Math.max(1, duration)) * sliderWidth - bubbleWidth / 2
                      )
                    ),
                  },
                ]}>
                <SpriteThumbnail cue={spriteCue} width={bubbleWidth} />
                <Text style={styles.bubbleTime}>{formatTime(scrubValue)}</Text>
              </View>
            );
          })()
        : null}
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={Math.max(1, duration)}
        value={value}
        minimumTrackTintColor={minimumTrackTintColor}
        maximumTrackTintColor={maximumTrackTintColor}
        thumbTintColor={thumbTintColor}
        disabled={disabled}
        onSlidingStart={onSlidingStart}
        onValueChange={onValueChange}
        onSlidingComplete={onSlidingComplete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    height: 36,
    justifyContent: 'center',
  },
  slider: {
    flex: 1,
    height: 36,
  },
  bubble: {
    position: 'absolute',
    bottom: 36,
    backgroundColor: 'rgba(0,0,0,0.85)',
    padding: 4,
    borderRadius: 8,
    alignItems: 'center',
    zIndex: 5,
  },
  bubbleTime: {
    color: '#fff',
    fontSize: 11,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
});
