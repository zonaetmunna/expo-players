// Subtitle sidecar downloader. Downloads each .vtt / .srt / .ttml file
// alongside the video into a stable per-id "subtitles/" subfolder, and
// returns the rewritten entries so the consumer can play with
// fully-offline subtitles.
//
// We deliberately do NOT touch HLS/DASH manifest-embedded subtitles here —
// those ride inside the segment fetch path. This module is only for the
// `source.subtitles` sidecar array on VideoItem.
//
// Cross-platform: only depends on global fetch + expo-file-system.

import * as FileSystem from 'expo-file-system/legacy';

import type { SideLoadedSubtitle } from '../../types/types';
import { withRetry } from './retry';

/** A subtitle entry whose URI has been rewritten to a local file path. */
export type LocalSubtitle = SideLoadedSubtitle;

/** Sanitize a language tag into a safe filename component. */
function safeName(s: string, fallback: string): string {
  const cleaned = s.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 32);
  return cleaned || fallback;
}

/**
 * Download every sidecar subtitle into `<targetDir>/subtitles/`. Returns the
 * rewritten entries — same shape as input, but `uri` now points at file://.
 *
 * Failures are logged and skipped — a missing subtitle shouldn't abort the
 * whole download. (Different policy than segments, where any miss = unplayable.)
 *
 * Returns an empty array when `subtitles` is empty/undefined.
 */
export async function downloadSubtitles(args: {
  subtitles: SideLoadedSubtitle[] | undefined;
  targetDir: string;
  isCancelled?: () => boolean;
}): Promise<LocalSubtitle[]> {
  const { subtitles, targetDir, isCancelled } = args;
  if (!subtitles || subtitles.length === 0) return [];

  const subDir = `${targetDir}/subtitles`;
  await FileSystem.makeDirectoryAsync(subDir, { intermediates: true });

  const results: LocalSubtitle[] = [];

  for (let i = 0; i < subtitles.length; i++) {
    if (isCancelled?.()) break;
    const sub = subtitles[i];
    // Filename: <index>-<language>.<ext>. Index disambiguates if two languages
    // collide after sanitization or if the same language has multiple tracks.
    const ext = sub.type === 'ttml' ? 'ttml' : sub.type === 'srt' ? 'srt' : 'vtt';
    const name = `${String(i).padStart(2, '0')}-${safeName(sub.language, 'sub')}.${ext}`;
    const localPath = `${subDir}/${name}`;
    try {
      await withRetry(
        async () => {
          const result = await FileSystem.downloadAsync(sub.uri, localPath);
          if (result.status >= 400) {
            throw new Error(`HTTP ${result.status} downloading subtitle ${sub.uri}`);
          }
        },
        { isCancelled, maxAttempts: 2 } // subtitles are small + non-critical, fewer retries
      );
      results.push({
        uri: localPath,
        title: sub.title,
        language: sub.language,
        type: sub.type,
      });
    } catch (err) {
      // Best-effort: log and skip. The video still plays without this subtitle.
      // Don't surface to user — they didn't ask for THIS subtitle to download,
      // they asked for the video. The original remote URI will still be tried
      // by rn-video at playback time if the consumer falls back to source.subtitles.
      if (__DEV__) {
        console.warn(`[downloads] subtitle download failed: ${sub.uri}`, err);
      }
    }
  }

  return results;
}
