// DASH MPD parser — pure functions, no I/O, no dependencies.
//
// Handles the segment formats used by ~all VOD DASH content in the wild:
//   - SegmentTemplate with $Number$ + duration + startNumber       (most common)
//   - SegmentTemplate with $Time$ + <SegmentTimeline>              (variable seg lengths)
//   - SegmentList with explicit <SegmentURL>                       (older streams)
//   - $RepresentationID$ + $Bandwidth$ template variables
//   - Optional <Initialization> segment per representation
//   - BaseURL inheritance (MPD → Period → AdaptationSet → Representation)
//   - Multi-period MPDs (concatenated as one timeline)
//
// Out of scope (intentional, MVP):
//   - SegmentBase byte-range (single-file representation indexed by SIDX)
//     — the file IS downloadable but the offline rewrite isn't trivial since
//       we'd have to serve byte ranges from a local file URL.
//   - DRM (ContentProtection) — license persistence needs paid SDK, same as HLS.
//   - LIVE (MPD@type="dynamic") — same reason as HLS: rolling window.
//   - Subtitle/captions adaptation sets — rn-video can stream these from the
//     remote MPD when needed, downloading them is a separate sidecar job.
//
// Reference: ISO/IEC 23009-1 (MPEG-DASH spec). dash.js source is the canonical
// implementation if you need an edge case.

/** A single video Representation we can pick. */
export type DashRepresentation = {
  /** Unique within the MPD (often "video=1500000" or "v0"). */
  id: string;
  /** Bits per second (REQUIRED in DASH). */
  bandwidth: number;
  /** Pixel width / height when present. */
  width?: number;
  height?: number;
  /** Codec string ("avc1.4d401f", "vp9", "av01.0.05M.08"). */
  codecs?: string;
  /** MIME type from AdaptationSet or Representation ("video/mp4"). */
  mimeType?: string;
  /** All segments (already URL-resolved against BaseURL chain). */
  segments: DashSegment[];
  /** Optional initialization segment — must be downloaded before media segs. */
  initSegmentUri?: string;
};

/** One media segment. */
export type DashSegment = {
  uri: string;
  /** Duration in seconds (computed from timescale + duration tick). */
  durationSec: number;
};

export type DashManifest = {
  /** Always at least 1. Sorted ascending by bandwidth. */
  videoRepresentations: DashRepresentation[];
  /** Audio representations (may be empty if audio is muxed into the video set). */
  audioRepresentations: DashRepresentation[];
  /** Total content duration across all periods. */
  totalDurationSec: number;
  /** True for VOD (MPD@type="static"). False = live, reject. */
  isVod: boolean;
};

// ─── XML helpers (regex-based, scoped to MPD shapes) ────────────────────────

/** Strip XML comments and CDATA so they don't trip the regex matchers. */
function stripCommentsAndCdata(xml: string): string {
  return xml.replace(/<!--[\s\S]*?-->/g, '').replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '');
}

/** Get the value of an attribute on an element opening tag. */
function attr(elementOpenTag: string, name: string): string | undefined {
  const re = new RegExp(`\\s${name}=["']([^"']*)["']`, 'i');
  const m = elementOpenTag.match(re);
  return m?.[1];
}

/**
 * Find every occurrence of <tagName ...>...</tagName> OR <tagName .../>.
 * Returns the matched substring + the inner text (empty for self-closed).
 * Greedy enough to handle nesting of *different* tags inside, but does NOT
 * support same-tag nesting (DASH doesn't nest e.g. <Period> inside <Period>).
 */
function findElements(
  xml: string,
  tagName: string
): { outer: string; openTag: string; inner: string }[] {
  const results: { outer: string; openTag: string; inner: string }[] = [];
  const re = new RegExp(`<${tagName}\\b([^>]*?)(/>|>([\\s\\S]*?)<\\/${tagName}>)`, 'g');
  while (true) {
    const m = re.exec(xml);
    if (m === null) break;
    const openTag = `<${tagName}${m[1]}>`;
    const inner = m[2] === '/>' ? '' : (m[3] ?? '');
    results.push({ outer: m[0], openTag, inner });
  }
  return results;
}

/** Extract <BaseURL>...</BaseURL> text values from a scope (returns first one
 *  per DASH semantics — multiple BaseURLs are CDN-redundancy, we just pick #1). */
function baseUrlIn(scope: string): string | undefined {
  const m = scope.match(/<BaseURL[^>]*>([\s\S]*?)<\/BaseURL>/);
  return m?.[1].trim();
}

/** Resolve a possibly-relative URL against a base URL (same logic as HLS parser). */
function resolveUri(base: string, ref: string): string {
  if (/^https?:\/\//i.test(ref)) return ref;
  if (ref.startsWith('//')) {
    const scheme = base.match(/^(https?):/i)?.[1] ?? 'https';
    return `${scheme}:${ref}`;
  }
  if (ref.startsWith('/')) {
    const m = base.match(/^(https?:\/\/[^/]+)/i);
    return m ? m[1] + ref : ref;
  }
  const baseDir = base.substring(0, base.lastIndexOf('/') + 1);
  return new URL(ref, baseDir).toString();
}

/** Compose a chain of BaseURLs (each possibly relative) against the MPD URL. */
function chainBase(mpdUri: string, ...bases: (string | undefined)[]): string {
  let resolved = mpdUri;
  // Strip the filename so resolving "seg-1.m4s" works against the directory.
  resolved = resolved.substring(0, resolved.lastIndexOf('/') + 1);
  for (const b of bases) {
    if (!b) continue;
    resolved = /^https?:\/\//i.test(b) ? b : resolveUri(resolved, b);
    // Ensure trailing slash so further relative resolves attach to the dir.
    if (!resolved.endsWith('/') && !resolved.includes('?')) resolved += '/';
  }
  return resolved;
}

/** Parse ISO 8601 duration (e.g. "PT1H23M45.6S") to seconds. */
function parseIsoDuration(d: string | undefined): number {
  if (!d) return 0;
  const m = d.match(/P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?)?/);
  if (!m) return 0;
  const days = parseFloat(m[1] ?? '0');
  const hours = parseFloat(m[2] ?? '0');
  const mins = parseFloat(m[3] ?? '0');
  const secs = parseFloat(m[4] ?? '0');
  return days * 86400 + hours * 3600 + mins * 60 + secs;
}

/**
 * Expand a DASH segment template by substituting $Number$, $Time$, $Bandwidth$,
 * $RepresentationID$. Handles the printf-like width spec ($Number%05d$).
 */
function expandTemplate(
  template: string,
  vars: { Number?: number; Time?: number; Bandwidth?: number; RepresentationID?: string }
): string {
  return template.replace(
    /\$(\$|RepresentationID|Bandwidth|Number|Time)(?:%0(\d+)d)?\$/g,
    (_, name, width) => {
      if (name === '$') return '$';
      if (name === 'RepresentationID') return vars.RepresentationID ?? '';
      const numericValue = vars[name as 'Number' | 'Time' | 'Bandwidth'];
      if (numericValue == null) return '';
      const s = String(numericValue);
      return width ? s.padStart(parseInt(width, 10), '0') : s;
    }
  );
}

// ─── Segment generators ────────────────────────────────────────────────────

/** SegmentTemplate + duration → derive segments by counting up from startNumber. */
function segmentsFromTemplateDuration(
  template: {
    media: string;
    initialization?: string;
    startNumber: number;
    duration: number;
    timescale: number;
  },
  totalDurationSec: number,
  baseUrl: string,
  repId: string,
  bandwidth: number
): { segments: DashSegment[]; initUri?: string } {
  const segDurSec = template.duration / template.timescale;
  if (segDurSec <= 0) return { segments: [] };
  const count = Math.ceil(totalDurationSec / segDurSec);
  const segments: DashSegment[] = [];
  for (let i = 0; i < count; i++) {
    const num = template.startNumber + i;
    const path = expandTemplate(template.media, {
      Number: num,
      RepresentationID: repId,
      Bandwidth: bandwidth,
    });
    segments.push({
      uri: resolveUri(baseUrl, path),
      // Last segment may be shorter — clamp for accuracy.
      durationSec: i === count - 1 ? totalDurationSec - i * segDurSec : segDurSec,
    });
  }
  const initUri = template.initialization
    ? resolveUri(
        baseUrl,
        expandTemplate(template.initialization, { RepresentationID: repId, Bandwidth: bandwidth })
      )
    : undefined;
  return { segments, initUri };
}

/** SegmentTemplate + <SegmentTimeline> → use explicit S elements (t, d, r). */
function segmentsFromTemplateTimeline(
  template: { media: string; initialization?: string; startNumber: number; timescale: number },
  timelineXml: string,
  baseUrl: string,
  repId: string,
  bandwidth: number
): { segments: DashSegment[]; initUri?: string } {
  const segments: DashSegment[] = [];
  let currentTime: number | undefined;
  let segmentNumber = template.startNumber;
  // Each <S t="..." d="..." r="..."/> produces (r+1) segments.
  const sRe = /<S\b([^/]*?)\/?>/g;
  while (true) {
    const m = sRe.exec(timelineXml);
    if (m === null) break;
    const sTag = `<S${m[1]}>`;
    const t = attr(sTag, 't');
    const d = attr(sTag, 'd');
    const r = attr(sTag, 'r');
    if (t != null) currentTime = parseInt(t, 10);
    const dur = parseInt(d ?? '0', 10);
    const repeat = parseInt(r ?? '0', 10);
    if (dur <= 0) continue;
    for (let i = 0; i <= repeat; i++) {
      const path = expandTemplate(template.media, {
        Number: segmentNumber,
        Time: currentTime,
        RepresentationID: repId,
        Bandwidth: bandwidth,
      });
      segments.push({
        uri: resolveUri(baseUrl, path),
        durationSec: dur / template.timescale,
      });
      if (currentTime != null) currentTime += dur;
      segmentNumber += 1;
    }
  }
  const initUri = template.initialization
    ? resolveUri(
        baseUrl,
        expandTemplate(template.initialization, { RepresentationID: repId, Bandwidth: bandwidth })
      )
    : undefined;
  return { segments, initUri };
}

/** SegmentList → explicit <SegmentURL media="..."/> entries. */
function segmentsFromList(
  listXml: string,
  duration: number,
  timescale: number,
  baseUrl: string
): { segments: DashSegment[]; initUri?: string } {
  const segments: DashSegment[] = [];
  const segDurSec = duration / timescale;
  const urlRe = /<SegmentURL\b([^/]*?)\/?>/g;
  while (true) {
    const m = urlRe.exec(listXml);
    if (m === null) break;
    const tag = `<SegmentURL${m[1]}>`;
    const media = attr(tag, 'media');
    if (!media) continue;
    segments.push({ uri: resolveUri(baseUrl, media), durationSec: segDurSec });
  }
  // Initialization sub-element of SegmentList (rare but spec-allowed).
  const init = listXml.match(/<Initialization\b([^/]*?)\/?>/);
  let initUri: string | undefined;
  if (init) {
    const initSrc = attr(`<Initialization${init[1]}>`, 'sourceURL');
    if (initSrc) initUri = resolveUri(baseUrl, initSrc);
  }
  return { segments, initUri };
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Parse a DASH MPD into the same shape we use for HLS — a list of video
 * representations (variants) with all segment URLs already resolved. The
 * caller picks one representation, downloads its init + segments, and
 * rewrites the MPD for offline playback.
 */
export function parseMpd(xml: string, mpdUri: string): DashManifest {
  const text = stripCommentsAndCdata(xml);

  // MPD root attributes — type, mediaPresentationDuration.
  const mpdOpen = text.match(/<MPD\b[^>]*>/)?.[0] ?? '<MPD>';
  const mpdType = attr(mpdOpen, 'type') ?? 'static';
  const isVod = mpdType === 'static';
  const mpdDuration = parseIsoDuration(attr(mpdOpen, 'mediaPresentationDuration'));
  const mpdBase = baseUrlIn(text);

  const videoReps: DashRepresentation[] = [];
  const audioReps: DashRepresentation[] = [];
  let totalDurationSec = 0;

  const periods = findElements(text, 'Period');
  // Some single-period MPDs omit the Period wrapper (rare). Treat the whole
  // doc as one period in that case.
  const periodScopes =
    periods.length > 0 ? periods : [{ inner: text, openTag: '<Period>', outer: text }];

  for (const period of periodScopes) {
    const periodDuration = parseIsoDuration(attr(period.openTag, 'duration')) || mpdDuration;
    totalDurationSec += periodDuration;
    const periodBase = baseUrlIn(period.inner);

    const adaptationSets = findElements(period.inner, 'AdaptationSet');
    for (const aset of adaptationSets) {
      const asetMime = attr(aset.openTag, 'mimeType') ?? '';
      const asetContentType = attr(aset.openTag, 'contentType') ?? '';
      // Classify the AdaptationSet. Modern fMP4 DASH puts video in one set and
      // audio in another; we need both to play offline correctly. (When audio
      // is muxed into video segments, there's no separate audio AdaptationSet
      // and audioReps stays empty — that case "just works" with video-only
      // download since the segments already contain the audio track.)
      const isVideo = asetMime.startsWith('video/') || asetContentType === 'video';
      const isAudio = asetMime.startsWith('audio/') || asetContentType === 'audio';
      // If neither attr is set we fall back to the Representation mimeType
      // check below to decide what bucket each rep lives in.
      const ambiguous = !isVideo && !isAudio;
      const asetBase = baseUrlIn(aset.inner);

      // SegmentTemplate / SegmentList may sit at the AdaptationSet level and
      // be inherited by all child Representations. We capture the OPEN TAG
      // for shared template attrs.
      const asetTplMatch = aset.inner.match(/<SegmentTemplate\b([^>]*?)(\/>|>)/);
      const asetTplAttrs = asetTplMatch ? `<SegmentTemplate${asetTplMatch[1]}>` : '';

      // SegmentTimeline lives inside SegmentTemplate (or SegmentList) — extract once at aset level.
      const asetTimeline = aset.inner.match(
        /<SegmentTimeline\b[^>]*>([\s\S]*?)<\/SegmentTimeline>/
      )?.[1];

      const reps = findElements(aset.inner, 'Representation');
      for (const rep of reps) {
        const repId = attr(rep.openTag, 'id') ?? '';
        const bandwidth = parseInt(attr(rep.openTag, 'bandwidth') ?? '0', 10);
        const width = parseInt(attr(rep.openTag, 'width') ?? '0', 10) || undefined;
        const height = parseInt(attr(rep.openTag, 'height') ?? '0', 10) || undefined;
        const codecs = attr(rep.openTag, 'codecs') ?? attr(aset.openTag, 'codecs');
        const repMime = attr(rep.openTag, 'mimeType') ?? asetMime;

        // Bucket: video, audio, or skip. Use AdaptationSet hint when present,
        // else fall back to Representation mimeType.
        const repIsAudio = isAudio || (ambiguous && repMime.startsWith('audio/'));
        const repIsVideo = isVideo || (ambiguous && repMime.startsWith('video/'));
        if (!repIsAudio && !repIsVideo) continue;

        const repBase = baseUrlIn(rep.inner);
        const baseUrl = chainBase(mpdUri, mpdBase, periodBase, asetBase, repBase);

        // Representation-level template overrides AdaptationSet-level.
        const repTplMatch = rep.inner.match(/<SegmentTemplate\b([^>]*?)(\/>|>)/);
        const tplAttrs = repTplMatch ? `<SegmentTemplate${repTplMatch[1]}>` : asetTplAttrs;
        const repTimeline =
          rep.inner.match(/<SegmentTimeline\b[^>]*>([\s\S]*?)<\/SegmentTimeline>/)?.[1] ??
          asetTimeline;

        let result: { segments: DashSegment[]; initUri?: string } = { segments: [] };

        if (tplAttrs) {
          const media = attr(tplAttrs, 'media') ?? '';
          const initialization = attr(tplAttrs, 'initialization');
          const startNumber = parseInt(attr(tplAttrs, 'startNumber') ?? '1', 10);
          const timescale = parseInt(attr(tplAttrs, 'timescale') ?? '1', 10);
          const duration = parseInt(attr(tplAttrs, 'duration') ?? '0', 10);

          if (repTimeline) {
            result = segmentsFromTemplateTimeline(
              { media, initialization, startNumber, timescale },
              repTimeline,
              baseUrl,
              repId,
              bandwidth
            );
          } else if (duration > 0) {
            result = segmentsFromTemplateDuration(
              { media, initialization, startNumber, duration, timescale },
              periodDuration,
              baseUrl,
              repId,
              bandwidth
            );
          }
        } else {
          // Try SegmentList.
          const listMatch = rep.inner.match(/<SegmentList\b([^>]*)>([\s\S]*?)<\/SegmentList>/);
          if (listMatch) {
            const listOpen = `<SegmentList${listMatch[1]}>`;
            const listInner = listMatch[2];
            const duration = parseInt(attr(listOpen, 'duration') ?? '0', 10);
            const timescale = parseInt(attr(listOpen, 'timescale') ?? '1', 10);
            result = segmentsFromList(listInner, duration, timescale, baseUrl);
          }
        }

        if (result.segments.length === 0) continue;
        const representation: DashRepresentation = {
          id: repId,
          bandwidth: Number.isFinite(bandwidth) ? bandwidth : 0,
          width,
          height,
          codecs,
          mimeType: repMime,
          segments: result.segments,
          initSegmentUri: result.initUri,
        };
        if (repIsAudio) audioReps.push(representation);
        else videoReps.push(representation);
      }
    }
  }

  videoReps.sort((a, b) => a.bandwidth - b.bandwidth);
  audioReps.sort((a, b) => a.bandwidth - b.bandwidth);
  return {
    videoRepresentations: videoReps,
    audioRepresentations: audioReps,
    totalDurationSec,
    isVod,
  };
}

/**
 * Pick the smallest audio representation. Audio quality differences are
 * inaudible at typical download bitrates (~96-128kbps), so the smallest is
 * always the right offline choice — saves disk + bandwidth.
 */
export function pickSmallestAudio(reps: DashRepresentation[]): DashRepresentation | undefined {
  if (reps.length === 0) return undefined;
  return reps[0]; // Already sorted ascending by bandwidth.
}

/**
 * Pick the representation whose height is closest to the target (default 720).
 * Falls back to bandwidth-based selection (~3 Mbps for 720p) when no
 * representations have explicit height info. Mirrors `pickVariantNear` from HLS.
 */
export function pickRepresentationNear(
  reps: DashRepresentation[],
  targetHeight = 720
): DashRepresentation {
  if (reps.length === 0) {
    throw new Error('pickRepresentationNear called with empty list');
  }
  if (reps.length === 1) return reps[0];

  const withHeight = reps.filter((r) => r.height && r.height > 0);
  if (withHeight.length > 0) {
    let best = withHeight[0];
    let bestDelta = Math.abs((best.height ?? 0) - targetHeight);
    for (const r of withHeight) {
      const delta = Math.abs((r.height ?? 0) - targetHeight);
      if (delta < bestDelta || (delta === bestDelta && r.bandwidth < best.bandwidth)) {
        best = r;
        bestDelta = delta;
      }
    }
    return best;
  }

  const targetBw = 3_000_000;
  let best = reps[0];
  let bestDelta = Math.abs(best.bandwidth - targetBw);
  for (const r of reps) {
    const delta = Math.abs(r.bandwidth - targetBw);
    if (delta < bestDelta) {
      best = r;
      bestDelta = delta;
    }
  }
  return best;
}
