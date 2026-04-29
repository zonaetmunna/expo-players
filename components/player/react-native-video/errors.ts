// Error classification for the react-native-video player. Translates raw
// native error payloads (ExoPlayer's ErrorCodes / AVFoundation's NSError)
// into user-facing { title, hint, retryable } objects.
//
// Design rules:
//   - Title is the headline (≤ 6 words).
//   - Hint is one sentence that tells the user what they can try.
//   - retryable: true when tapping "Retry" might actually help (network blips,
//     server hiccups). false when retrying will always fail (codec missing,
//     unsupported format, geo-block) — the skin can hide the Retry button.
//   - DRM errors are handled separately by drm.ts/describeDrmError(); this
//     file only fires when that returns null.
//
// We pattern-match on the same fields that show up across iOS and Android:
//     errorString, errorCode, code, domain, localizedDescription, ...
// Most of the signal lives in errorString (Android) and localizedDescription
// (iOS). We intentionally keep the matchers loose — exact codes vary across
// device manufacturers and platform versions.

import type { OnVideoErrorData } from 'react-native-video';

export type FriendlyError = {
  /** ≤ 6-word headline shown in the error overlay. */
  title: string;
  /** One-sentence recovery suggestion shown below the title. */
  hint: string;
  /** When false, the Retry button should be hidden — retrying won't help. */
  retryable: boolean;
  /**
   * Internal category for logging / analytics. Not shown to the user.
   * Useful when wiring this up to QoE dashboards later.
   */
  category:
    | 'network'
    | 'http'
    | 'timeout'
    | 'parse'
    | 'codec'
    | 'format'
    | 'source-not-found'
    | 'cancelled'
    | 'unknown';
};

type RawError = {
  errorString?: string;
  errorCode?: number | string;
  code?: number | string;
  domain?: string;
  localizedDescription?: string;
  localizedFailureReason?: string;
  errorException?: string;
};

/** Pull the inner error payload off rn-video's onError envelope. */
function unwrap(e: OnVideoErrorData | unknown): RawError {
  const inner = (e as { error?: unknown })?.error ?? e;
  return (inner ?? {}) as RawError;
}

/** Build the lowercased haystack we run regexes against. */
function haystack(err: RawError): string {
  return [
    err.errorString,
    err.localizedDescription,
    err.localizedFailureReason,
    err.errorException,
    err.domain,
    String(err.errorCode ?? ''),
    String(err.code ?? ''),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** Try to extract an HTTP status code mentioned in the error string. */
function extractHttpStatus(s: string): number | null {
  // Matches "Response code: 403", "status 404", "HTTP 500", etc.
  const m = s.match(/(?:response code|status(?:\s?code)?|http)\s*[:\s]\s*(\d{3})/i);
  if (m) return parseInt(m[1], 10);
  return null;
}

/**
 * Classify an rn-video error payload into a friendly message.
 *
 * Order matters — most-specific signatures first so we don't fall through to
 * a generic message when something more accurate is available.
 */
export function describeError(raw: OnVideoErrorData | unknown): FriendlyError {
  const err = unwrap(raw);
  const text = haystack(err);

  if (!text) {
    return {
      title: 'Playback failed',
      hint: 'Something went wrong loading this video. Try again in a moment.',
      retryable: true,
      category: 'unknown',
    };
  }

  // ---------- Source / file not found (HTTP 4xx) ----------
  const httpStatus = extractHttpStatus(text);
  if (httpStatus != null) {
    if (httpStatus === 403) {
      return {
        title: 'Access denied',
        hint: 'The server refused this video. It may be geo-restricted or require sign-in.',
        retryable: false,
        category: 'http',
      };
    }
    if (httpStatus === 404) {
      return {
        title: 'Video not found',
        hint: 'This video URL no longer exists. Try a different sample.',
        retryable: false,
        category: 'source-not-found',
      };
    }
    if (httpStatus === 401) {
      return {
        title: 'Sign in required',
        hint: 'This video needs authentication. Add a valid token to the source headers.',
        retryable: false,
        category: 'http',
      };
    }
    if (httpStatus >= 500 && httpStatus < 600) {
      return {
        title: 'Server problem',
        hint: 'The video server is having trouble. Try again in a few seconds.',
        retryable: true,
        category: 'http',
      };
    }
    if (httpStatus >= 400 && httpStatus < 500) {
      return {
        title: 'Cannot load video',
        hint: `The server rejected the request (HTTP ${httpStatus}). Check the URL or your connection.`,
        retryable: false,
        category: 'http',
      };
    }
  }

  // ---------- Timeout ----------
  if (/timed?\s?out|timeout/.test(text)) {
    return {
      title: 'Connection timed out',
      hint: 'The server took too long to respond. Check your internet and try again.',
      retryable: true,
      category: 'timeout',
    };
  }

  // ---------- Network / connection ----------
  // Android: "UnknownHostException", "Failed to connect", "ECONNREFUSED"
  // iOS: domain "NSURLErrorDomain" with codes -1003 (host not found),
  //      -1009 (no internet), -1004 (cannot connect to host)
  if (
    /unknownhostexception|nsurlerror|failed to connect|econnrefused|enetunreach|no internet|not connected to the internet|network is unreachable|hostname could not be found|cannot find host|cannot connect to host/.test(
      text
    )
  ) {
    return {
      title: 'No connection',
      hint: 'You appear to be offline. Check your internet connection and tap Retry.',
      retryable: true,
      category: 'network',
    };
  }

  // ---------- SSL / certificate problems ----------
  if (/sslhandshake|ssl error|certificate|trust evaluation|cleartext/.test(text)) {
    return {
      title: 'Secure connection failed',
      hint: 'The video server\'s SSL certificate could not be verified.',
      retryable: false,
      category: 'network',
    };
  }

  // ---------- Manifest / parse errors ----------
  // ExoPlayer: ParserException, MalformedManifestException
  // AVFoundation: AVErrorContentIsUnavailable + parse messages
  if (/parserexception|malformedmanifest|manifest.*error|invalid manifest|unable to parse/.test(text)) {
    return {
      title: 'Stream manifest error',
      hint: 'The video playlist is malformed or corrupted. The publisher needs to fix it.',
      retryable: false,
      category: 'parse',
    };
  }

  // ---------- Codec / decoder unavailable ----------
  // ExoPlayer: "Decoder init failed", "MediaCodecRenderer", "DecoderQueryException"
  // AVFoundation: AVErrorMediaServicesWereReset, AVErrorContentIsUnavailable
  if (
    /decoder.*init|decoderqueryexception|mediacodecrenderer|no decoder|format not supported by decoder|codecs?\s+not\s+supported/.test(
      text
    )
  ) {
    return {
      title: 'Format not supported',
      hint: 'Your device cannot decode this video format. Try a lower-quality variant.',
      retryable: false,
      category: 'codec',
    };
  }

  // ---------- Unsupported container / format ----------
  if (
    /unsupported.*format|unrecognized.*format|cannot be opened|not a valid|cannot decode/.test(
      text
    )
  ) {
    return {
      title: 'Unsupported video',
      hint: 'This video file is not in a format your device can play.',
      retryable: false,
      category: 'format',
    };
  }

  // ---------- ExoPlayer source error (file unreachable, generic IO) ----------
  // Only fires when no HTTP status was extracted above.
  if (/exoplaybackexception.*source|source\s?error|io_bad_http_status|behindlivewindow/.test(text)) {
    return {
      title: 'Cannot reach video',
      hint: 'The video file could not be loaded. The server may be down or the link is wrong.',
      retryable: true,
      category: 'network',
    };
  }

  // ---------- Cancelled / aborted ----------
  if (/cancelled|aborted|interrupted/.test(text)) {
    return {
      title: 'Playback cancelled',
      hint: 'The video request was cancelled. Tap Retry to load it again.',
      retryable: true,
      category: 'cancelled',
    };
  }

  // ---------- Fall-through ----------
  // Pick a short string from the raw payload to give the user *some* signal,
  // but keep it under 80 chars so it doesn't dominate the overlay.
  const rawSnippet =
    err.errorString ?? err.localizedDescription ?? err.localizedFailureReason ?? '';
  const trimmed = rawSnippet.trim().slice(0, 80);

  return {
    title: 'Playback failed',
    hint: trimmed
      ? `Something went wrong: ${trimmed}`
      : 'Something went wrong loading this video. Try again in a moment.',
    retryable: true,
    category: 'unknown',
  };
}
