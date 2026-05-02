// Owns the error overlay state, the retry mechanism, and the DRM-aware
// classifier wiring. Returns a `reloadKey` that the consumer threads onto
// the <Video key=...> prop — incrementing it forces rn-video to remount and
// re-fetch the source (the canonical retry pattern for media players).

import { useCallback, useMemo, useState } from 'react';
import type { OnVideoErrorData } from 'react-native-video';

import { describeDrmError } from '../features/drm/drm';
import type { VideoDRM } from '../types/types';
import { describeError, type FriendlyError } from './errors';

type Options = {
  /**
   * Optional DRM config — when present, errors are routed through
   * `describeDrmError` first before falling through to the generic classifier.
   */
  drm?: VideoDRM;
};

export type PlayerError = {
  /** Friendly error object — null when no error. */
  error: FriendlyError | null;
  /** Manually clear the current error (e.g. on source change). */
  clearError: () => void;
  /** Bump this to force rn-video to remount and reload the source. */
  reloadKey: number;
  /** Wire to the error overlay's Retry button. */
  onRetry: () => void;
  /** Wire to <Video onError>. */
  handleError: (e: OnVideoErrorData) => void;
};

export function usePlayerError({ drm }: Options): PlayerError {
  const [error, setError] = useState<FriendlyError | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const handleError = useCallback(
    (e: OnVideoErrorData) => {
      // Always log the raw payload at warn level so diagnostics survive even
      // when the user sees a friendly summary. iOS error objects sometimes
      // contain circular references → guard JSON.stringify.
      let serialized: string;
      try {
        serialized = JSON.stringify(e, null, 2);
      } catch {
        serialized = String(e);
      }
      // eslint-disable-next-line no-console
      console.warn('[rn-video] onError raw:', serialized);

      // 1. DRM errors take priority — much more actionable than generic.
      if (drm) {
        const drmMsg = describeDrmError(e);
        if (drmMsg) {
          setError({
            title: 'Cannot play this video',
            hint: drmMsg,
            retryable: false,
            category: 'unknown',
          });
          return;
        }
      }

      // 2. Generic classifier handles HTTP / network / timeout / codec / parse.
      setError(describeError(e));
    },
    [drm]
  );

  const onRetry = useCallback(() => {
    setError(null);
    setReloadKey((k) => k + 1);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Memoize so consumers don't see a fresh object identity on every render —
  // important because effects with this object in their deps would re-fire
  // every render otherwise (state churn).
  return useMemo(
    () => ({ error, clearError, reloadKey, onRetry, handleError }),
    [error, clearError, reloadKey, onRetry, handleError]
  );
}
