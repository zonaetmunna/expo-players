// Network-aware retry helper for segment + key + init downloads.
//
// Strategy: exponential backoff with jitter, bounded attempts. The classic
// "AWS SDK / Google API Client" pattern adapted for video segments.
//   attempt 1 → fail → wait ~500ms ± jitter
//   attempt 2 → fail → wait ~1000ms ± jitter
//   attempt 3 → fail → throw
//
// Why jitter: when the CDN bounces, every concurrent worker fails at the
// same instant. Without jitter all 4 retry simultaneously, hammer the CDN
// in lockstep, and bounce again. With jitter the retries spread out and
// the CDN gets breathing room.
//
// Why only 3 attempts: more attempts mostly help on truly intermittent
// failures (mobile cell handover ~3-5s). Past 3 tries something is
// structurally wrong — the segment URL is bad, the CDN is down, the cert
// expired — and silently retrying for 30s just frustrates users.

export type RetryOptions = {
  /** Total attempts including the first. Default 3 (1 initial + 2 retries). */
  maxAttempts?: number;
  /** Base delay in ms. Doubles each attempt. Default 500. */
  baseDelayMs?: number;
  /** Cap on the delay so we don't wait minutes. Default 5000. */
  maxDelayMs?: number;
  /** Cooperative cancellation — if it returns true between attempts, abort. */
  isCancelled?: () => boolean;
};

/** HTTP status codes worth retrying. 4xx (except 408/429) are caller errors,
 *  no point retrying. 5xx + network errors should retry. */
function isRetryable(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  // Our downloaders throw "HTTP 503 ..." — extract the status.
  const m = message.match(/HTTP (\d+)/);
  if (m) {
    const code = parseInt(m[1], 10);
    if (code === 408 || code === 429) return true; // timeout / rate-limit
    if (code >= 500 && code < 600) return true; // server error
    return false; // 4xx (404, 403, 401, …) — won't fix itself
  }
  // Network-level errors (DNS, TCP reset, TLS) bubble up as Error without HTTP code.
  return true;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Run `fn` with bounded retries. Throws the last error if all attempts fail
 * or if `isCancelled` returned true between attempts.
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 500;
  const maxDelayMs = opts.maxDelayMs ?? 5000;
  const isCancelled = opts.isCancelled ?? (() => false);

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (isCancelled()) throw new Error('cancelled');
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      // Non-retryable (e.g. 404) → fail fast, surface to user.
      if (!isRetryable(err)) throw err;
      if (attempt === maxAttempts) break;
      // Exponential backoff with ±25% jitter.
      const exp = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      const jitter = exp * (Math.random() * 0.5 - 0.25);
      await sleep(Math.max(0, exp + jitter));
    }
  }
  throw lastError;
}
