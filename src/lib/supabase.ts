/**
 * Supabase client configuration
 */

import { createClient } from '@supabase/supabase-js';
import type { Note } from '@/types/note';

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL');
}

if (!supabaseAnonKey) {
  throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

/**
 * Public Supabase client for client-side and public API operations
 * Uses the anon key with RLS policies
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Admin Supabase client for server-side operations that need to bypass RLS
 * Only use this in API routes, never expose to the client
 */
export function getServiceClient() {
  if (!supabaseServiceRoleKey) {
    throw new Error('Missing environment variable: SUPABASE_SERVICE_ROLE_KEY');
  }
  if (!supabaseUrl) {
    throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL');
  }
  return createClient(supabaseUrl, supabaseServiceRoleKey);
}

/**
 * Database type definitions
 */
export interface Database {
  public: {
    Tables: {
      notes: {
        Row: Note;
        Insert: Omit<Note, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Note, 'id' | 'created_at' | 'updated_at'>>;
      };
    };
  };
}
