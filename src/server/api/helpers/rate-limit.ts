/**
 * In-memory sliding-window rate limiter.
 *
 * Per-process only: counters live in this instance's memory and are NOT shared
 * across instances, so in a multi-instance / serverless deployment each
 * instance enforces the limit independently. The `checkRateLimit` surface is
 * deliberately small so the store can later be swapped for a shared backend
 * (Postgres, Upstash) without touching callers.
 */

import type { PrismaClient } from "../../../../generated/prisma";

export interface RateLimitOptions {
  /** Max requests allowed per key within the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Requests remaining in the current window (0 when blocked). */
  remaining: number;
  /** Milliseconds until the caller may retry / the window frees a slot. */
  resetMs: number;
}

// key -> ascending list of hit timestamps (ms) within the current window.
const hits = new Map<string, number[]>();
let lastSweep = 0;

/** Periodically drop keys whose newest hit has fallen out of the window. */
function sweep(now: number, windowMs: number): void {
  if (now - lastSweep < windowMs) return;
  lastSweep = now;
  const cutoff = now - windowMs;
  for (const [key, times] of hits) {
    if (times.length === 0 || times[times.length - 1]! <= cutoff) {
      hits.delete(key);
    }
  }
}

/**
 * Record a hit for `key` and report whether it is within the limit. A blocked
 * request is NOT recorded, so a client that backs off recovers as the window
 * slides rather than being penalized for retrying.
 *
 * `now` is injectable for deterministic tests; it defaults to `Date.now()`.
 */
export function checkRateLimit(
  key: string,
  { limit, windowMs }: RateLimitOptions,
  now: number = Date.now(),
): RateLimitResult {
  sweep(now, windowMs);
  const windowStart = now - windowMs;
  const recent = (hits.get(key) ?? []).filter((t) => t > windowStart);

  if (recent.length >= limit) {
    hits.set(key, recent);
    const oldest = recent[0]!;
    return {
      allowed: false,
      remaining: 0,
      resetMs: Math.max(0, oldest + windowMs - now),
    };
  }

  recent.push(now);
  hits.set(key, recent);
  return { allowed: true, remaining: limit - recent.length, resetMs: windowMs };
}

/**
 * Postgres-backed fixed-window rate limiter — shared across app instances,
 * unlike `checkRateLimit`. Each request atomically upserts a per-key counter
 * that resets when the request lands in a new window. A single SQL statement
 * keeps it race-free under concurrency.
 *
 * Fixed-window semantics (vs. the in-memory sliding window): a blocked request
 * still increments the counter, so a hammering client stays blocked until the
 * window rolls over. `now` is injectable for deterministic tests.
 */
export async function checkRateLimitPg(
  db: PrismaClient,
  key: string,
  { limit, windowMs }: RateLimitOptions,
  now: number = Date.now(),
): Promise<RateLimitResult> {
  // Align to a fixed window boundary so every instance agrees on the bucket.
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);

  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO rate_limits ("key", "window_start", "count")
    VALUES (${key}, ${windowStart}, 1)
    ON CONFLICT ("key") DO UPDATE
    SET "count" = CASE
          WHEN "rate_limits"."window_start" = ${windowStart}
          THEN "rate_limits"."count" + 1
          ELSE 1
        END,
        "window_start" = ${windowStart},
        "updated_at" = now()
    RETURNING "count"
  `;

  const count = Number(rows[0]?.count ?? limit + 1);
  const resetMs = Math.max(0, windowStart.getTime() + windowMs - now);
  if (count > limit) {
    return { allowed: false, remaining: 0, resetMs };
  }
  return { allowed: true, remaining: limit - count, resetMs };
}

/**
 * Identify the caller for rate-limiting: client IP from proxy headers when
 * available, else the authenticated user id, else a shared anonymous bucket.
 */
export function clientId(headers: Headers, userId?: string | null): string {
  const nonEmpty = (s: string | null | undefined): string | undefined => {
    const trimmed = s?.trim();
    if (!trimmed) return undefined;
    return trimmed;
  };
  const ip =
    nonEmpty(headers.get("x-forwarded-for")?.split(",")[0]) ??
    nonEmpty(headers.get("x-real-ip"));
  return ip ?? userId ?? "anonymous";
}
