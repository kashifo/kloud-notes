/**
 * Zod validation schemas for request validation
 */

import { z } from 'zod';
import { NOTE, PASSWORD, SHORT_CODE } from './constants';

/**
 * Schema for creating a new note
 */
export const createNoteSchema = z.object({
  content: z
    .string()
    .min(1, 'Note content cannot be empty')
    .max(NOTE.MAX_SIZE_CHARS, `Note content cannot exceed ${NOTE.MAX_SIZE_CHARS} characters`)
    .refine((content) => {
      const byteSize = new Blob([content]).size;
      return byteSize <= NOTE.MAX_SIZE_BYTES;
    }, `Note size cannot exceed ${NOTE.MAX_SIZE_BYTES / 1024} KB`),

  password: z
    .string()
    .min(PASSWORD.MIN_LENGTH, `Password must be at least ${PASSWORD.MIN_LENGTH} characters`)
    .max(PASSWORD.MAX_LENGTH, `Password cannot exceed ${PASSWORD.MAX_LENGTH} characters`)
    .optional(),

  customCode: z
    .string()
    .min(SHORT_CODE.MIN_LENGTH, `Custom code must be at least ${SHORT_CODE.MIN_LENGTH} characters`)
    .max(SHORT_CODE.CUSTOM_MAX_LENGTH, `Custom code cannot exceed ${SHORT_CODE.CUSTOM_MAX_LENGTH} characters`)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Custom code can only contain letters, numbers, hyphens, and underscores')
    .optional(),
});

/**
 * Schema for verifying a password
 */
export const verifyPasswordSchema = z.object({
  shortCode: z
    .string()
    .min(1, 'Short code is required'),

  password: z
    .string()
    .min(1, 'Password is required'),
});

/**
 * Schema for fetching a note by short code
 */
export const fetchNoteSchema = z.object({
  code: z
    .string()
    .min(1, 'Short code is required'),
});

/**
 * Type exports for use in API routes
 */
export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type VerifyPasswordInput = z.infer<typeof verifyPasswordSchema>;
export type FetchNoteInput = z.infer<typeof fetchNoteSchema>;
