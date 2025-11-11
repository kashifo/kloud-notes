/**
 * Type definitions for the Kloud Notes application
 */

/**
 * Database note structure
 */
export interface Note {
  id: string;
  short_code: string;
  content: string;
  password_hash: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Public note structure (without password hash)
 */
export interface PublicNote {
  id: string;
  short_code: string;
  content: string;
  has_password: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Request body for creating a note
 */
export interface CreateNoteRequest {
  content: string;
  password?: string;
  customCode?: string;
}

/**
 * Request body for updating a note
 */
export interface UpdateNoteRequest {
  content?: string;
  password?: string;
  newShortCode?: string;
}

/**
 * Response after creating a note
 */
export interface CreateNoteResponse {
  shortCode: string;
  url: string;
}

/**
 * Request body for verifying a password
 */
export interface VerifyPasswordRequest {
  shortCode: string;
  password: string;
}

/**
 * Response after verifying a password
 */
export interface VerifyPasswordResponse {
  valid: boolean;
  note?: PublicNote;
}

/**
 * Error response structure
 */
export interface ErrorResponse {
  error: string;
  message?: string;
}
