/**
 * Application-wide constants and configuration
 */

/**
 * Short code configuration
 */
export const SHORT_CODE = {
  MIN_LENGTH: 6,
  MAX_LENGTH: 8,
  CUSTOM_MAX_LENGTH: 50,
  GENERATION_ATTEMPTS: 5,
} as const;

/**
 * Note content limits
 */
export const NOTE = {
  MAX_SIZE_BYTES: 1024 * 1024, // 1 MB
  MAX_SIZE_CHARS: 100000, // 100k characters
} as const;

/**
 * Password configuration
 */
export const PASSWORD = {
  MIN_LENGTH: 4,
  MAX_LENGTH: 100,
  BCRYPT_ROUNDS: 10,
} as const;

/**
 * Rate limiting configuration
 */
export const RATE_LIMIT = {
  CREATE_NOTE: {
    requests: 120,
    window: '1m' as const, // 120 requests per minute (allows fast auto-save)
  },
  VERIFY_PASSWORD: {
    requests: 10,
    window: '1m' as const, // 10 requests per minute
  },
  FETCH_NOTE: {
    requests: 60,
    window: '1m' as const, // 60 requests per minute
  },
} as const;

/**
 * Application URLs
 */
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/**
 * Database table names
 */
export const TABLES = {
  NOTES: 'notes',
} as const;
