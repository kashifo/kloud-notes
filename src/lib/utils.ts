/**
 * Utility functions for the application
 */

import { nanoid } from 'nanoid';
import { SHORT_CODE, APP_URL } from './constants';

/**
 * Generates a random short code for a note
 * @param length - Length of the short code (default: 8)
 * @returns A random alphanumeric short code
 */
export function generateShortCode(length: number = SHORT_CODE.MAX_LENGTH): string {
  return nanoid(length);
}

/**
 * Validates that a custom short code meets requirements
 * @param code - The custom short code to validate
 * @returns True if the code is valid
 */
export function isValidShortCode(code: string): boolean {
  const regex = /^[a-zA-Z0-9_-]+$/;
  return (
    code.length >= SHORT_CODE.MIN_LENGTH &&
    code.length <= SHORT_CODE.CUSTOM_MAX_LENGTH &&
    regex.test(code)
  );
}

/**
 * Generates a full URL for a note
 * @param shortCode - The short code for the note
 * @returns The full URL to access the note
 */
export function generateNoteUrl(shortCode: string): string {
  return `${APP_URL}/${shortCode}`;
}

/**
 * Formats a date string into a human-readable format
 * @param dateString - ISO date string
 * @returns Formatted date string
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export interface RawNoteData {
  short_code: string;
  content: string;
  password_hash?: string | null;
  created_at?: { toDate: () => Date } | string | Date;
  updated_at?: { toDate: () => Date } | string | Date;
  [key: string]: unknown;
}

/**
 * Converts a note to public format (removes sensitive data) from Firestore
 */
export function toPublicNoteFromFirestore(noteId: string, data: RawNoteData) {
  return {
    id: noteId,
    short_code: data.short_code,
    content: data.content,
    has_password: !!data.password_hash,
    created_at: data.created_at && typeof (data.created_at as { toDate?: () => Date }).toDate === 'function' 
      ? (data.created_at as { toDate: () => Date }).toDate().toISOString() 
      : data.created_at as string,
    updated_at: data.updated_at && typeof (data.updated_at as { toDate?: () => Date }).toDate === 'function' 
      ? (data.updated_at as { toDate: () => Date }).toDate().toISOString() 
      : data.updated_at as string,
  };
}
