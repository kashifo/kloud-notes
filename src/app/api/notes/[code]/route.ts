/**
 * API Route: GET /api/notes/[code]
 * Fetches a note by its short code
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { toPublicNote } from '@/lib/utils';
import { getClientIp } from '@/lib/security';
import { TABLES } from '@/lib/constants';
import { fetchNoteRateLimit, checkRateLimit } from '@/lib/ratelimit';
import type { PublicNote, ErrorResponse } from '@/types/note';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
): Promise<NextResponse<PublicNote | ErrorResponse>> {
  try {
    // Rate limiting
    const clientIp = getClientIp(request.headers);

    if (fetchNoteRateLimit) {
      const { success, remaining } = await fetchNoteRateLimit.limit(clientIp);
      if (!success) {
        return NextResponse.json(
          { error: 'Too many requests. Please try again later.' },
          { status: 429, headers: { 'X-RateLimit-Remaining': remaining?.toString() || '0' } }
        );
      }
    } else {
      // Fallback to in-memory rate limiting
      const { success } = await checkRateLimit(clientIp, 30, 60000);
      if (!success) {
        return NextResponse.json(
          { error: 'Too many requests. Please try again later.' },
          { status: 429 }
        );
      }
    }

    // Get code from params
    const { code } = await params;

    if (!code) {
      return NextResponse.json(
        { error: 'Short code is required' },
        { status: 400 }
      );
    }

    // Fetch note from database
    const { data: note, error: fetchError } = await supabase
      .from(TABLES.NOTES)
      .select('*')
      .eq('short_code', code)
      .single();

    if (fetchError || !note) {
      return NextResponse.json(
        { error: 'Note not found' },
        { status: 404 }
      );
    }

    // If note is password protected, don't return content
    if (note.password_hash) {
      return NextResponse.json(
        {
          ...toPublicNote(note),
          content: '', // Don't return content for password-protected notes
        },
        { status: 200 }
      );
    }

    // Return public note
    return NextResponse.json(toPublicNote(note), { status: 200 });
  } catch (error) {
    console.error('Unexpected error in GET /api/notes/[code]:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
