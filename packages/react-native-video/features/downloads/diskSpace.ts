// Disk-space guard. Prevents the player from starting a download that would
// fill the device. Two checks:
//
//   1. Minimum headroom: refuse to start any download if free space is below
//      MIN_FREE_BYTES. Devices behave badly when storage is critically low —
//      OS pop-ups, file write failures, app crashes. Keep clear of that.
//
//   2. Estimated fit: when we can estimate the download size (HLS/DASH from
//      bandwidth × duration, MP4 from a HEAD request), refuse if it wouldn't
//      fit with at least MIN_FREE_AFTER_BYTES of headroom remaining.
//
// We don't try to enforce a per-app quota here — that's a product decision
// (settings UI: "Max downloads: 5GB") that lives in the consumer app, not
// the player package. The player just guards against the OS-level cliff.

import * as FileSystem from 'expo-file-system/legacy';

/** Minimum free space required to even attempt a download. 500MB. */
const MIN_FREE_BYTES = 500 * 1024 * 1024;

/** Minimum free space that must remain AFTER the download completes. 200MB. */
const MIN_FREE_AFTER_BYTES = 200 * 1024 * 1024;

export class DiskSpaceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiskSpaceError';
  }
}

/**
 * Throw a DiskSpaceError if the device is critically low on storage, or if
 * `estimatedBytes` (when known) wouldn't leave enough headroom.
 *
 * Pass estimatedBytes = 0 (or omit) when the size isn't known yet — only the
 * minimum-headroom check applies. Useful as a pre-flight before fetching the
 * manifest; call again with the real estimate after parsing.
 */
export async function ensureDiskSpace(estimatedBytes = 0): Promise<void> {
  let free: number;
  try {
    free = await FileSystem.getFreeDiskStorageAsync();
  } catch {
    // If the API is unavailable on this platform/runtime, don't block — fall
    // through and let the actual write fail with a real error if it's going
    // to fail. Better UX than a false-positive guard.
    return;
  }

  if (free < MIN_FREE_BYTES) {
    throw new DiskSpaceError(
      `Not enough free space (${formatMB(free)} available; need at least ${formatMB(MIN_FREE_BYTES)} to start a download).`
    );
  }

  if (estimatedBytes > 0 && free - estimatedBytes < MIN_FREE_AFTER_BYTES) {
    throw new DiskSpaceError(
      `This download is about ${formatMB(estimatedBytes)} but only ${formatMB(free - MIN_FREE_AFTER_BYTES)} can be safely used right now. Free up some space and try again.`
    );
  }
}

/**
 * Estimate the size of an HLS/DASH download from the picked variant's bandwidth
 * and the content's duration. Returns 0 if either input is missing — caller
 * should fall back to the headroom-only check in that case.
 *
 *   bytes ≈ (bandwidth bits/sec ÷ 8) × duration sec
 *
 * Real downloads come in slightly under the bandwidth figure (CBR content) or
 * slightly over (VBR with peaks). Off by ~10–20%, which is fine for a safety
 * check that only refuses obviously-too-big downloads.
 */
export function estimateBytesFromBitrate(
  bandwidthBitsPerSec: number | undefined,
  durationSec: number | undefined
): number {
  if (!bandwidthBitsPerSec || !durationSec) return 0;
  return Math.round((bandwidthBitsPerSec / 8) * durationSec);
}

function formatMB(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}
