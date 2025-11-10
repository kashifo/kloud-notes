/**
 * API Route: POST /api/notes
 * Creates a new note with optional password protection
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createNoteSchema } from '@/lib/validation';
import { hashPassword, getClientIp } from '@/lib/security';
import { generateShortCode, generateNoteUrl } from '@/lib/utils';
import { SHORT_CODE, TABLES } from '@/lib/constants';
import { createNoteRateLimit, checkRateLimit } from '@/lib/ratelimit';
import type { CreateNoteResponse, ErrorResponse } from '@/types/note';

export async function POST(request: NextRequest): Promise<NextResponse<CreateNoteResponse | ErrorResponse>> {
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
      // Fallback to in-memory rate limiting
      const { success } = await checkRateLimit(clientIp, 5, 60000);
      if (!success) {
        return NextResponse.json(
          { error: 'Too many requests. Please try again later.' },
          { status: 429 }
        );
      }
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = createNoteSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          message: validation.error.issues[0].message,
        },
        { status: 400 }
      );
    }

    const { content, password, customCode } = validation.data;

    // Generate or use custom short code
    let shortCode = customCode;
    let attempts = 0;

    if (!shortCode) {
      // Generate a unique short code
      while (attempts < SHORT_CODE.GENERATION_ATTEMPTS) {
        shortCode = generateShortCode();

        // Check if code already exists
        const { data: existing } = await supabase
          .from(TABLES.NOTES)
          .select('id')
          .eq('short_code', shortCode)
          .single();

        if (!existing) break;
        attempts++;
      }

      if (attempts >= SHORT_CODE.GENERATION_ATTEMPTS) {
        return NextResponse.json(
          { error: 'Failed to generate unique short code. Please try again.' },
          { status: 500 }
        );
      }
    } else {
      // Check if custom code is available
      const { data: existing } = await supabase
        .from(TABLES.NOTES)
        .select('id')
        .eq('short_code', shortCode)
        .single();

      if (existing) {
        return NextResponse.json(
          { error: 'This custom code is already in use. Please choose another.' },
          { status: 409 }
        );
      }
    }

    // Hash password if provided
    const passwordHash = password ? await hashPassword(password) : null;

    // Insert note into database
    const { data: note, error: insertError } = await supabase
      .from(TABLES.NOTES)
      .insert({
        short_code: shortCode!,
        content,
        password_hash: passwordHash,
      })
      .select()
      .single();

    if (insertError || !note) {
      console.error('Database insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to create note. Please try again.' },
        { status: 500 }
      );
    }

    // Generate URL and return response
    const url = generateNoteUrl(note.short_code);

    return NextResponse.json(
      {
        shortCode: note.short_code,
        url,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Unexpected error in POST /api/notes:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
