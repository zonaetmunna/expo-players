import { useCallback, useEffect, useRef, useState } from 'react';

type Options = {
  initiallyVisible?: boolean;
  hideAfterMs?: number;
  /** When true, controls stay visible (e.g. while paused, scrubbing, settings open) */
  pinned?: boolean;
};

export function useControlsAutoHide({
  initiallyVisible = true,
  hideAfterMs = 3000,
  pinned = false,
}: Options = {}) {
  const [visible, setVisible] = useState(initiallyVisible);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearTimer();
    if (pinned) return;
    timerRef.current = setTimeout(() => setVisible(false), hideAfterMs);
  }, [clearTimer, hideAfterMs, pinned]);

  const show = useCallback(() => {
    setVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  const hide = useCallback(() => {
    clearTimer();
    setVisible(false);
  }, [clearTimer]);

  const toggle = useCallback(() => {
    if (visible) hide();
    else show();
  }, [visible, show, hide]);

  useEffect(() => {
    if (pinned) {
      clearTimer();
      setVisible(true);
    } else if (visible) {
      scheduleHide();
    }
  }, [pinned, visible, scheduleHide, clearTimer]);

  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  return { visible, show, hide, toggle };
}
