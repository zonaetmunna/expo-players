// HLS m3u8 parser — pure functions, no React, no I/O, no dependencies.
// Handles the most common HLS shapes:
//   - Master playlist with multi-bitrate variants
//   - Variant playlist with .ts segments + optional AES-128 key
//   - Relative segment URLs (resolved against playlist URL)
//
// Out of scope (intentional, MVP):
//   - DRM (Widevine/FairPlay license persistence — needs native code)
//   - Byte-range segments (#EXT-X-BYTERANGE)
//   - fMP4 init segments (#EXT-X-MAP)
//   - Multi-period / SCTE-35 ad markers
//   - Live playlists (#EXT-X-PLAYLIST-TYPE:EVENT and rolling windows)
// These can be layered on later. For your catalog (Apple BipBop, Mux test
// streams, Tears of Steel, Unified Streaming) the basic shape works.

/** A single ABR variant from a master playlist. */
export type HlsVariant = {
  /** Absolute URL of the variant's own .m3u8 playlist. */
  uri: string;
  /** Bits per second from BANDWIDTH attribute. Always present in valid HLS. */
  bandwidth: number;
  /** "1280x720" form, when present. */
  resolution?: string;
  /** Parsed height (720 from "1280x720"), used by variant picker. */
  height?: number;
  /** Codec list ("avc1.4d401f,mp4a.40.2"), informational. */
  codecs?: string;
  /** GROUP-ID of the audio rendition this variant references, if any. When
   *  present, audio lives in a separate playlist (HlsMedia) — modern fMP4 HLS
   *  splits A/V. When absent, audio is muxed into the variant's segments. */
  audioGroupId?: string;
  /** GROUP-ID of the subtitle rendition, if any. */
  subtitlesGroupId?: string;
};

/** A side rendition (audio or subtitles) declared with #EXT-X-MEDIA. */
export type HlsMedia = {
  type: 'AUDIO' | 'SUBTITLES';
  groupId: string;
  name: string;
  language?: string;
  /** Absolute URL of the rendition's own playlist. Undefined when audio is
   *  muxed into the variant (declarative-only entry, no separate stream). */
  uri?: string;
  isDefault?: boolean;
  autoselect?: boolean;
};

/** A single segment in a variant playlist. */
export type HlsSegment = {
  /** Absolute URL of the segment file (.ts / .m4s / .aac). Used for fetching. */
  uri: string;
  /** The exact string as it appeared on the URI line in the playlist text.
   *  Used for rewriting the playlist for offline — segment URIs in HLS are
   *  often relative (e.g. "seg-001.ts" or "../media/seg.ts"), and the
   *  rewriter must replace THIS verbatim, not the resolved absolute. */
  rawUri: string;
  /** Duration in seconds from #EXTINF. */
  durationSec: number;
};

/** Optional AES-128 encryption key for the variant. */
export type HlsKey = {
  /** Always 'AES-128' for now — we reject other methods (DRM keys etc). */
  method: 'AES-128';
  /** Absolute URL where the key bytes live. Used for fetching. */
  uri: string;
  /** Exact URI string from the #EXT-X-KEY line — used for rewriting. */
  rawUri: string;
  /** Hex IV string (e.g. "0x1234abcd...") if specified. */
  iv?: string;
};

export type HlsMaster = {
  /** Always at least 1. Sorted ascending by bandwidth. */
  variants: HlsVariant[];
  /** All declared #EXT-X-MEDIA renditions (audio + subtitles). */
  media: HlsMedia[];
};

export type HlsVariantPlaylist = {
  segments: HlsSegment[];
  /** Total content duration (sum of segment durations). */
  totalDurationSec: number;
  /** Optional encryption key applied to all segments. */
  key?: HlsKey;
  /** Target segment duration from #EXT-X-TARGETDURATION (informational). */
  targetDurationSec?: number;
  /** True when the playlist had #EXT-X-ENDLIST (VOD). False = live, skip. */
  isVod: boolean;
};

/** Resolves a possibly-relative URL against a base playlist URL. */
function resolveUri(base: string, ref: string): string {
  // Already absolute → use as-is
  if (/^https?:\/\//i.test(ref)) return ref;
  // Protocol-relative ("//cdn.foo.com/x") → inherit scheme
  if (ref.startsWith('//')) {
    const scheme = base.match(/^(https?):/i)?.[1] ?? 'https';
    return `${scheme}:${ref}`;
  }
  // Root-relative ("/path/seg.ts") → keep scheme + host
  if (ref.startsWith('/')) {
    const m = base.match(/^(https?:\/\/[^/]+)/i);
    return m ? m[1] + ref : ref;
  }
  // Plain relative ("seg.ts" or "../foo/seg.ts") → resolve against base dir
  const baseDir = base.substring(0, base.lastIndexOf('/') + 1);
  return new URL(ref, baseDir).toString();
}

/** Parses a single attribute string like 'BANDWIDTH=1280000,RESOLUTION=1280x720,CODECS="avc1.4d"' */
function parseAttrs(line: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  // Match KEY=VALUE pairs, where VALUE is either quoted "..." or unquoted up to next comma.
  const re = /([A-Z0-9-]+)=("([^"]*)"|([^,]+))/g;
  while (true) {
    const m = re.exec(line);
    if (m === null) break;
    attrs[m[1]] = m[3] ?? m[4] ?? '';
  }
  return attrs;
}

/**
 * Parses a master playlist. Returns variants sorted by bandwidth ascending.
 * If the playlist has no variants (i.e. it's actually a media playlist), returns
 * an empty array and the caller should treat the original URL as a single variant.
 */
export function parseMaster(text: string, masterUri: string): HlsMaster {
  const lines = text.split(/\r?\n/);
  const variants: HlsVariant[] = [];
  const media: HlsMedia[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // #EXT-X-MEDIA declares a side rendition (audio or subtitles). It carries
    // a TYPE, GROUP-ID, NAME, optional URI (absent → muxed in the variant),
    // LANGUAGE, DEFAULT, AUTOSELECT.
    if (line.startsWith('#EXT-X-MEDIA:')) {
      const attrs = parseAttrs(line.substring('#EXT-X-MEDIA:'.length));
      const type = attrs.TYPE;
      if (type === 'AUDIO' || type === 'SUBTITLES') {
        media.push({
          type,
          groupId: attrs['GROUP-ID'] ?? '',
          name: attrs.NAME ?? '',
          language: attrs.LANGUAGE || undefined,
          uri: attrs.URI ? resolveUri(masterUri, attrs.URI) : undefined,
          isDefault: attrs.DEFAULT === 'YES',
          autoselect: attrs.AUTOSELECT === 'YES',
        });
      }
      continue;
    }

    if (!line.startsWith('#EXT-X-STREAM-INF:')) continue;
    const attrs = parseAttrs(line.substring('#EXT-X-STREAM-INF:'.length));
    // Next non-empty, non-comment line is the variant URI.
    let uriLine = '';
    for (let j = i + 1; j < lines.length; j++) {
      const t = lines[j].trim();
      if (!t || t.startsWith('#')) continue;
      uriLine = t;
      break;
    }
    if (!uriLine) continue;

    const bandwidth = parseInt(attrs.BANDWIDTH ?? '0', 10);
    const resolution = attrs.RESOLUTION || undefined;
    const height = resolution
      ? parseInt(resolution.split('x')[1] ?? '0', 10) || undefined
      : undefined;
    variants.push({
      uri: resolveUri(masterUri, uriLine),
      bandwidth: Number.isFinite(bandwidth) ? bandwidth : 0,
      resolution,
      height,
      codecs: attrs.CODECS || undefined,
      audioGroupId: attrs.AUDIO || undefined,
      subtitlesGroupId: attrs.SUBTITLES || undefined,
    });
  }

  variants.sort((a, b) => a.bandwidth - b.bandwidth);
  return { variants, media };
}

/**
 * Pick an audio rendition for a variant. Prefers the variant's audioGroupId,
 * then DEFAULT=YES within that group, then first match. Returns undefined if
 * audio is muxed (no separate URI on any matching rendition) or no audio at all.
 */
export function pickAudioRendition(master: HlsMaster, variant: HlsVariant): HlsMedia | undefined {
  if (!variant.audioGroupId) return undefined;
  const group = master.media.filter(
    (m) => m.type === 'AUDIO' && m.groupId === variant.audioGroupId && m.uri
  );
  if (group.length === 0) return undefined; // all entries are muxed-in (no URI)
  return group.find((m) => m.isDefault) ?? group[0];
}

/** Parses a variant (media) playlist. Returns segments + optional key. */
export function parseVariant(text: string, variantUri: string): HlsVariantPlaylist {
  const lines = text.split(/\r?\n/);
  const segments: HlsSegment[] = [];
  let pendingDuration = 0;
  let totalDurationSec = 0;
  let key: HlsKey | undefined;
  let targetDurationSec: number | undefined;
  let isVod = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXT-X-TARGETDURATION:')) {
      targetDurationSec = parseFloat(line.substring('#EXT-X-TARGETDURATION:'.length));
      continue;
    }
    if (line.startsWith('#EXT-X-ENDLIST')) {
      isVod = true;
      continue;
    }
    if (line.startsWith('#EXT-X-KEY:')) {
      const attrs = parseAttrs(line.substring('#EXT-X-KEY:'.length));
      // We only support clear AES-128. Any other method (SAMPLE-AES, NONE
      // followed by AES, etc.) we don't handle in MVP.
      if (attrs.METHOD === 'AES-128' && attrs.URI) {
        key = {
          method: 'AES-128',
          uri: resolveUri(variantUri, attrs.URI),
          // Preserve the exact attribute value so the rewriter can find it
          // in the playlist text — could be relative ("key.bin") or absolute.
          rawUri: attrs.URI,
          iv: attrs.IV || undefined,
        };
      }
      continue;
    }
    if (line.startsWith('#EXTINF:')) {
      // #EXTINF:9.009,optional title
      const durStr = line.substring('#EXTINF:'.length).split(',')[0];
      pendingDuration = parseFloat(durStr) || 0;
      continue;
    }
    if (line.startsWith('#')) continue; // ignore other tags

    // Non-tag line after an EXTINF → it's a segment URI.
    if (pendingDuration > 0) {
      segments.push({
        uri: resolveUri(variantUri, line),
        // Preserve the exact line as written in the playlist so the rewriter
        // can do a byte-exact replace. `line` is already trimmed above.
        rawUri: line,
        durationSec: pendingDuration,
      });
      totalDurationSec += pendingDuration;
      pendingDuration = 0;
    }
  }

  return { segments, totalDurationSec, key, targetDurationSec, isVod };
}

/**
 * Pick the variant whose height is closest to the target (default 720).
 * Falls back to bandwidth-based selection when no variants have height info.
 * Always returns one of the input variants (caller guarantees non-empty).
 */
export function pickVariantNear(variants: HlsVariant[], targetHeight = 720): HlsVariant {
  if (variants.length === 0) {
    throw new Error('pickVariantNear called with empty variants array');
  }
  if (variants.length === 1) return variants[0];

  // Prefer variants with explicit height info.
  const withHeight = variants.filter((v) => v.height && v.height > 0);
  if (withHeight.length > 0) {
    let best = withHeight[0];
    let bestDelta = Math.abs((best.height ?? 0) - targetHeight);
    for (const v of withHeight) {
      const delta = Math.abs((v.height ?? 0) - targetHeight);
      // Tie-break: prefer the lower bandwidth (smaller file)
      if (delta < bestDelta || (delta === bestDelta && v.bandwidth < best.bandwidth)) {
        best = v;
        bestDelta = delta;
      }
    }
    return best;
  }

  // No height info → pick bandwidth closest to ~3 Mbps (typical 720p).
  const targetBw = 3_000_000;
  let best = variants[0];
  let bestDelta = Math.abs(best.bandwidth - targetBw);
  for (const v of variants) {
    const delta = Math.abs(v.bandwidth - targetBw);
    if (delta < bestDelta) {
      best = v;
      bestDelta = delta;
    }
  }
  return best;
}

/** Quick sniff: does this text look like a master (has STREAM-INF) or variant (has EXTINF)? */
export function isMasterPlaylist(text: string): boolean {
  return /\n#EXT-X-STREAM-INF/.test(`\n${text}`);
}
