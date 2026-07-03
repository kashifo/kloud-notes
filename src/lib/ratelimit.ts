/**
 * Rate limiting configuration and utilities
 * Uses Upstash Redis if configured, otherwise falls back to in-memory rate limiting
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { RATE_LIMIT } from './constants';

// Check if Upstash is configured
const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

// Create Redis client if Upstash is configured
const redis = upstashUrl && upstashToken
  ? new Redis({
      url: upstashUrl,
      token: upstashToken,
    })
  : null;

/**
 * Rate limiter for note creation
 */
export const createNoteRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(
        RATE_LIMIT.CREATE_NOTE.requests,
        RATE_LIMIT.CREATE_NOTE.window
      ),
      analytics: true,
      prefix: '@upstash/ratelimit:create',
    })
  : null;

/**
 * Rate limiter for password verification
 */
export const verifyPasswordRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(
        RATE_LIMIT.VERIFY_PASSWORD.requests,
        RATE_LIMIT.VERIFY_PASSWORD.window
      ),
      analytics: true,
      prefix: '@upstash/ratelimit:verify',
    })
  : null;

/**
 * Rate limiter for note updates (auto-saving)
 */
export const updateNoteRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(
        RATE_LIMIT.UPDATE_NOTE.requests,
        RATE_LIMIT.UPDATE_NOTE.window
      ),
      analytics: true,
      prefix: '@upstash/ratelimit:update',
    })
  : null;

/**
 * Rate limiter for fetching notes
 */
export const fetchNoteRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(
        RATE_LIMIT.FETCH_NOTE.requests,
        RATE_LIMIT.FETCH_NOTE.window
      ),
      analytics: true,
      prefix: '@upstash/ratelimit:fetch',
    })
  : null;

/**
 * Rate limiter for custom-code availability checks
 */
export const checkCodeRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(
        RATE_LIMIT.CHECK_CODE.requests,
        RATE_LIMIT.CHECK_CODE.window
      ),
      analytics: true,
      prefix: '@upstash/ratelimit:check',
    })
  : null;

/**
 * Simple in-memory rate limiting fallback
 * This is not production-ready for multi-instance deployments
 */
const inMemoryCache = new Map<string, { count: number; resetAt: number }>();

export async function checkRateLimit(
  identifier: string,
  action: string,
  limit: number,
  windowMs: number
): Promise<{ success: boolean; remaining?: number }> {
  const now = Date.now();
  const cacheKey = `${identifier}_${action}`;
  const cached = inMemoryCache.get(cacheKey);

  if (!cached || now > cached.resetAt) {
    inMemoryCache.set(cacheKey, {
      count: 1,
      resetAt: now + windowMs,
    });
    return { success: true, remaining: limit - 1 };
  }

  if (cached.count >= limit) {
    return { success: false, remaining: 0 };
  }

  cached.count += 1;
  return { success: true, remaining: limit - cached.count };
}


