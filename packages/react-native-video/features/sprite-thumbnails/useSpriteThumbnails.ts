import { useEffect, useMemo, useRef, useState } from 'react';

import type { SpriteThumbnails } from '../../types/types';

export type SpriteCue = {
  startSec: number;
  endSec: number;
  /** Resolved absolute URL of the sprite sheet image */
  spriteUri: string;
  /** Pixel rect of the tile within the sprite sheet */
  x: number;
  y: number;
  w: number;
  h: number;
};

type ParsedVtt = {
  cues: SpriteCue[];
  /** Default sprite URL inferred from the first cue (used as a fallback) */
  defaultSpriteUri: string;
};

/**
 * Parses a WebVTT thumbnails file. Each cue's payload is one of:
 *   sprite.jpg#xywh=0,0,160,90
 *   sprite.jpg
 *   https://cdn/sprite.png#xywh=160,0,160,90
 *
 * If the payload has no #xywh, the whole image is treated as one tile.
 */
function parseWebVttThumbnails(vttText: string, vttBaseUrl: string): ParsedVtt {
  const lines = vttText.replace(/\r/g, '').split('\n');
  const cues: SpriteCue[] = [];
  let defaultSpriteUri = '';

  // VTT timestamps allow either `HH:MM:SS.mmm` or `MM:SS.mmm` form.
  // Capture both halves and parse each independently.
  const TS = '(?:(\\d{1,2}):)?(\\d{1,2}):(\\d{2})[.,](\\d{1,3})';
  const cueRegex = new RegExp(`${TS}\\s*-->\\s*${TS}`);

  const parseTimestamp = (h: string | undefined, m: string, s: string, ms: string) =>
    (h ? Number(h) * 3600 : 0) + Number(m) * 60 + Number(s) + Number(ms) / 1000;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const timeMatch = line.match(cueRegex);
    if (!timeMatch) continue;

    const startSec = parseTimestamp(timeMatch[1], timeMatch[2], timeMatch[3], timeMatch[4]);
    const endSec = parseTimestamp(timeMatch[5], timeMatch[6], timeMatch[7], timeMatch[8]);

    // Payload is on next non-empty line(s). Take the first non-empty.
    let payload = '';
    for (let j = i + 1; j < lines.length; j++) {
      const t = lines[j].trim();
      if (t === '') break;
      payload = t;
      break;
    }
    if (!payload) continue;

    const [imgPart, hashPart] = payload.split('#');
    const spriteUri = resolveUrl(imgPart, vttBaseUrl);
    if (!defaultSpriteUri) defaultSpriteUri = spriteUri;

    let x = 0,
      y = 0,
      w = 0,
      h = 0;
    if (hashPart) {
      const xywhMatch = hashPart.match(/xywh=(\d+),(\d+),(\d+),(\d+)/);
      if (xywhMatch) {
        x = Number(xywhMatch[1]);
        y = Number(xywhMatch[2]);
        w = Number(xywhMatch[3]);
        h = Number(xywhMatch[4]);
      }
    }

    cues.push({ startSec, endSec, spriteUri, x, y, w, h });
  }

  return { cues, defaultSpriteUri };
}

function resolveUrl(maybeRelative: string, base: string): string {
  if (/^https?:\/\//i.test(maybeRelative)) return maybeRelative;
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return maybeRelative;
  }
}

type Result = {
  /** True when sprite data is loaded and ready to look up */
  ready: boolean;
  error: string | null;
  /** Returns the cue covering the given time, or null when nothing matches yet */
  getCueAt: (timeSec: number) => SpriteCue | null;
};

/**
 * Fetches and parses a WebVTT sprite-thumbnails file once per source change.
 * Returns a stable lookup function keyed by timestamp (binary search for O(log N)).
 */
export function useSpriteThumbnails(config: SpriteThumbnails | undefined): Result {
  const [parsed, setParsed] = useState<ParsedVtt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastConfigKeyRef = useRef<string>('');

  useEffect(() => {
    if (!config?.vttUri) {
      setParsed(null);
      setError(null);
      lastConfigKeyRef.current = '';
      return;
    }
    const key = `${config.vttUri}|${config.spriteUri ?? ''}`;
    if (lastConfigKeyRef.current === key) return;
    lastConfigKeyRef.current = key;

    let cancelled = false;
    const controller = new AbortController();
    setError(null);
    setParsed(null);

    (async () => {
      try {
        const res = await fetch(config.vttUri, { signal: controller.signal });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} fetching ${config.vttUri}`);
        }
        const text = await res.text();
        if (cancelled) return;
        const baseUrl = config.spriteUri ? config.spriteUri : config.vttUri;
        const result = parseWebVttThumbnails(text, baseUrl);
        // If cues had no embedded sprite image (e.g. single-image VTT) and a
        // spriteUri override was provided, fall back to it.
        if (
          (!result.defaultSpriteUri || result.cues.every((c) => !c.spriteUri)) &&
          config.spriteUri
        ) {
          for (const c of result.cues) {
            c.spriteUri = config.spriteUri;
          }
          result.defaultSpriteUri = config.spriteUri;
        }
        setParsed(result);
      } catch (e) {
        if (cancelled) return;
        // Ignore abort errors — they're our own cancellations
        if (e instanceof Error && e.name === 'AbortError') return;
        setError(e instanceof Error ? e.message : 'Failed to load thumbnails');
        setParsed(null);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [config?.vttUri, config?.spriteUri, config]);

  const getCueAt = useMemo(() => {
    const cues = parsed?.cues ?? [];
    return (timeSec: number): SpriteCue | null => {
      if (cues.length === 0) return null;
      // Binary search for the cue whose [startSec, endSec) covers timeSec
      let lo = 0;
      let hi = cues.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >>> 1;
        const c = cues[mid];
        if (timeSec < c.startSec) hi = mid - 1;
        else if (timeSec >= c.endSec) lo = mid + 1;
        else return c;
      }
      // Time fell outside any cue — clamp to nearest
      if (timeSec < cues[0].startSec) return cues[0];
      return cues[cues.length - 1];
    };
  }, [parsed]);

  return {
    ready: !!parsed && parsed.cues.length > 0,
    error,
    getCueAt,
  };
}
