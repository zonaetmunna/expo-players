// Shared control state used by every skin. Encapsulates:
//   - scrubbing (slider drag)
//   - seekPending (post-seek "settling" lock so the thumb doesn't jump)
//   - settingsOpen
//   - auto-hide pin/unpin logic
//   - debounced single-tap toggle (so double-tap gestures don't flash controls)
//   - sprite cue lookup
// Skin components consume this via one hook call and then render their own UI.

import { useEffect, useRef, useState } from 'react';
import { useCurrentTime } from '../../core/useSnapshotField';
import type { SpriteThumbnails } from '../../types/types';
import { useSpriteThumbnails } from '../sprite-thumbnails/useSpriteThumbnails';
import type { SkinProps } from './types';
import { useControlsAutoHide } from './useControlsAutoHide';

type Args = Pick<
  SkinProps,
  | 'snapshot'
  | 'state'
  | 'isLive'
  | 'hasError'
  | 'isCasting'
  | 'isEnded'
  | 'spriteThumbnails'
  | 'onSeek'
  | 'onPlay'
  | 'onPause'
  | 'onReplay'
>;

export function useSkinControlsState({
  snapshot,
  state,
  isLive,
  hasError,
  isCasting = false,
  isEnded = false,
  spriteThumbnails,
  onSeek,
  onPlay,
  onPause,
  onReplay,
}: Args) {
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [seekPending, setSeekPending] = useState<number | null>(null);

  // currentTime is a hot field — read via the subscriber hook (4Hz cadence)
  // instead of straight from state, so a paused video doesn't render at all
  // and a playing one re-renders only the scrubber, not the whole player tree.
  const currentTime = useCurrentTime(snapshot);

  const sprites = useSpriteThumbnails(spriteThumbnails as SpriteThumbnails | undefined);
  const spriteCue = sprites.ready && scrubbing ? sprites.getCueAt(scrubValue) : null;

  const showLoading = !state.isLoaded && !hasError;
  const pinned = scrubbing || settingsOpen || showLoading || hasError;
  const autoHide = useControlsAutoHide({ pinned });

  // Auto-close settings sheet when cast starts
  useEffect(() => {
    if (isCasting && settingsOpen) setSettingsOpen(false);
  }, [isCasting, settingsOpen]);

  // Clear seekPending when the player has caught up
  useEffect(() => {
    if (seekPending == null) return;
    if (Math.abs(currentTime - seekPending) < 0.7) {
      setSeekPending(null);
    }
  }, [currentTime, seekPending]);

  // Safety net: force-clear seekPending after 5s
  const seekTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (seekPending == null) return;
    seekTimeoutRef.current = setTimeout(() => {
      setSeekPending(null);
      setScrubbing(false);
    }, 5000);
    return () => {
      if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
    };
  }, [seekPending]);

  const togglePlay = () => {
    autoHide.show();
    if (isEnded && onReplay) {
      onReplay();
      return;
    }
    if (state.isPlaying) onPause();
    else onPlay();
  };

  const seekRelative = (delta: number) => {
    autoHide.show();
    if (isLive || !state.isLoaded || !state.duration) return;
    const target = Math.max(0, Math.min(state.duration, snapshot.current.currentTime + delta));
    setSeekPending(target);
    onSeek(target);
  };

  const onScrubStart = () => {
    setScrubbing(true);
    setScrubValue(snapshot.current.currentTime);
    autoHide.show();
  };

  // Throttle slider value updates to ~20Hz to avoid render storm
  const lastScrubUpdateRef = useRef(0);
  const onScrubChange = (value: number) => {
    const now = Date.now();
    if (now - lastScrubUpdateRef.current < 50) return;
    lastScrubUpdateRef.current = now;
    setScrubValue(value);
  };

  const onScrubComplete = (value: number) => {
    const target = Math.max(0, Math.min(state.duration || value, value));
    setSeekPending(target);
    onSeek(target);
    setScrubbing(false);
    autoHide.show();
  };

  // Debounced single-tap so double-tap gestures don't flash the controls
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleTapLayerPress = () => {
    if (tapTimerRef.current) {
      clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
      return;
    }
    tapTimerRef.current = setTimeout(() => {
      tapTimerRef.current = null;
      autoHide.toggle();
    }, 280);
  };
  useEffect(() => {
    return () => {
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    };
  }, []);

  const safeDuration =
    isLive || !Number.isFinite(state.duration) || state.duration <= 0 ? 1 : state.duration;

  const sliderValue = scrubbing
    ? scrubValue
    : seekPending != null
      ? seekPending
      : currentTime;

  return {
    scrubbing,
    scrubValue,
    settingsOpen,
    setSettingsOpen,
    seekPending,
    spriteCue,
    showLoading,
    autoHide,
    visible: autoHide.visible,
    safeDuration,
    sliderValue,
    togglePlay,
    seekRelative,
    onScrubStart,
    onScrubChange,
    onScrubComplete,
    handleTapLayerPress,
  };
}
