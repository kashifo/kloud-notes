/**
 * API Route: POST /api/verify
 * Verifies password for a password-protected note
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyPasswordSchema } from '@/lib/validation';
import { verifyPassword, getClientIp } from '@/lib/security';
import { toPublicNote } from '@/lib/utils';
import { TABLES } from '@/lib/constants';
import { verifyPasswordRateLimit, checkRateLimit } from '@/lib/ratelimit';
import type { VerifyPasswordResponse, ErrorResponse } from '@/types/note';

export async function POST(
  request: NextRequest
): Promise<NextResponse<VerifyPasswordResponse | ErrorResponse>> {
  try {
    // Rate limiting (more strict to prevent brute force)
    const clientIp = getClientIp(request.headers);

    if (verifyPasswordRateLimit) {
      const { success, remaining } = await verifyPasswordRateLimit.limit(clientIp);
      if (!success) {
        return NextResponse.json(
          { error: 'Too many password attempts. Please try again later.' },
          { status: 429, headers: { 'X-RateLimit-Remaining': remaining?.toString() || '0' } }
        );
      }
    } else {
      // Fallback to in-memory rate limiting
      const { success } = await checkRateLimit(clientIp, 10, 60000);
      if (!success) {
        return NextResponse.json(
          { error: 'Too many password attempts. Please try again later.' },
          { status: 429 }
        );
      }
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = verifyPasswordSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          message: validation.error.issues[0].message,
        },
        { status: 400 }
      );
    }

    const { shortCode, password } = validation.data;

    // Fetch note from database
    const { data: note, error: fetchError } = await supabase
      .from(TABLES.NOTES)
      .select('*')
      .eq('short_code', shortCode)
      .single();

    if (fetchError || !note) {
      return NextResponse.json(
        { error: 'Note not found' },
        { status: 404 }
      );
    }

    // Check if note has password protection
    if (!note.password_hash) {
      return NextResponse.json(
        { error: 'This note is not password protected' },
        { status: 400 }
      );
    }

    // Verify password
    const isValid = await verifyPassword(password, note.password_hash);

    if (!isValid) {
      // Add a small delay to prevent timing attacks
      await new Promise(resolve => setTimeout(resolve, 1000));

      return NextResponse.json(
        { valid: false },
        { status: 401 }
      );
    }

    // Return note with content
    return NextResponse.json(
      {
        valid: true,
        note: toPublicNote(note),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Unexpected error in POST /api/verify:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
