/**
 * API Route: GET /api/notes/[code]
 * Fetches a note by its short code
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { toPublicNote } from '@/lib/utils';
import { getClientIp, hashPassword, verifyPassword } from '@/lib/security';
import { TABLES } from '@/lib/constants';
import { fetchNoteRateLimit, checkRateLimit, createNoteRateLimit } from '@/lib/ratelimit';
import { updateNoteSchema } from '@/lib/validation';
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

/**
 * API Route: PATCH /api/notes/[code]
 * Updates a note by its short code
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
): Promise<NextResponse<PublicNote | ErrorResponse>> {
  try {
    // Rate limiting
    const clientIp = getClientIp(request.headers);

    if (createNoteRateLimit) {
      const { success, remaining } = await createNoteRateLimit.limit(clientIp);
      if (!success) {
        return NextResponse.json(
          { error: 'Too many requests. Please try again later.' },
          { status: 429, headers: { 'X-RateLimit-Remaining': remaining?.toString() || '0' } }
        );
      }
    } else {
      const { success } = await checkRateLimit(clientIp, 5, 60000);
      if (!success) {
        return NextResponse.json(
          { error: 'Too many requests. Please try again later.' },
          { status: 429 }
        );
      }
    }

    const { code } = await params;

    if (!code) {
      return NextResponse.json(
        { error: 'Short code is required' },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = updateNoteSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          message: validation.error.issues[0].message,
        },
        { status: 400 }
      );
    }

    const { content, password, newShortCode } = validation.data;

    // Fetch existing note
    const { data: existingNote, error: fetchError } = await supabase
      .from(TABLES.NOTES)
      .select('*')
      .eq('short_code', code)
      .single();

    if (fetchError || !existingNote) {
      return NextResponse.json(
        { error: 'Note not found' },
        { status: 404 }
      );
    }

    // If note has password, verify it before allowing update
    if (existingNote.password_hash && password) {
      const isValid = await verifyPassword(password, existingNote.password_hash);
      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid password' },
          { status: 401 }
        );
      }
    }

    // If newShortCode is provided, check if it's available
    if (newShortCode && newShortCode !== code) {
      const { data: existingCode } = await supabase
        .from(TABLES.NOTES)
        .select('id')
        .eq('short_code', newShortCode)
        .single();

      if (existingCode) {
        return NextResponse.json(
          { error: 'Short code already in use' },
          { status: 409 }
        );
      }
    }

    // Hash new password if provided
    const passwordHash = password && !existingNote.password_hash
      ? await hashPassword(password)
      : existingNote.password_hash;

    // Prepare update data
    const updateData: { content?: string; password_hash?: string | null; short_code?: string } = {};
    if (content !== undefined) updateData.content = content;
    if (passwordHash !== undefined) updateData.password_hash = passwordHash;
    if (newShortCode && newShortCode !== code) updateData.short_code = newShortCode;

    // Update note
    const { data: updatedNote, error: updateError } = await supabase
      .from(TABLES.NOTES)
      .update(updateData)
      .eq('short_code', code)
      .select()
      .single();

    if (updateError || !updatedNote) {
      console.error('Database update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update note. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json(toPublicNote(updatedNote), { status: 200 });
  } catch (error) {
    console.error('Unexpected error in PATCH /api/notes/[code]:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
