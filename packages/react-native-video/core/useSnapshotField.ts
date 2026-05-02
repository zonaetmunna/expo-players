// Subscriber hooks for hot snapshot fields. The fields themselves are written
// directly into the snapshot ref by useRnvPlayerEvents (NO React state), so a
// 4Hz onProgress event doesn't trigger tree-wide re-renders. Components that
// actually display these fields (the scrubber, the buffering spinner) use
// these hooks to opt into a controlled re-render cadence.

import { useEffect, useState } from 'react';

import type { RnvSnapshotRef } from './useRnvPlayerSnapshot';

/**
 * Subscribe to currentTime updates at ~4Hz (250ms). The scrubber thumb only
 * needs to move smoothly to the human eye — re-rendering more often is wasted.
 */
export function useCurrentTime(snapshot: RnvSnapshotRef): number {
  const [time, setTime] = useState(snapshot.current.currentTime);
  useEffect(() => {
    const id = setInterval(() => {
      const next = snapshot.current.currentTime;
      // Only trigger re-render if value actually changed (paused video → no churn).
      setTime((prev) => (prev === next ? prev : next));
    }, 250);
    return () => clearInterval(id);
  }, [snapshot]);
  return time;
}

/**
 * Subscribe to buffering changes. Polls at 4Hz; re-renders only on transitions
 * (true ↔ false), so an active or idle player generates no churn.
 */
export function useBuffering(snapshot: RnvSnapshotRef): boolean {
  const [buffering, setBuffering] = useState(snapshot.current.buffering);
  useEffect(() => {
    const id = setInterval(() => {
      const next = snapshot.current.buffering;
      setBuffering((prev) => (prev === next ? prev : next));
    }, 250);
    return () => clearInterval(id);
  }, [snapshot]);
  return buffering;
}
