/**
 * API Route: POST /api/notes
 * Creates a new note with optional password protection
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue, Transaction } from 'firebase-admin/firestore';
import { createNoteSchema } from '@/lib/validation';
import { hashPassword, getClientIp } from '@/lib/security';
import { generateShortCode, generateNoteUrl } from '@/lib/utils';
import { SHORT_CODE } from '@/lib/constants';
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

    const db = getAdminDb();
    let finalShortCode = '';
    let attempts = 0;

    const passwordHash = password ? await hashPassword(password) : null;

    if (customCode) {
      finalShortCode = customCode;
      const success = await db.runTransaction(async (transaction: Transaction) => {
        const noteRef = db.collection('kloudNotes').doc(finalShortCode);
        const noteDoc = await transaction.get(noteRef);

        if (noteDoc.exists) {
          return false;
        }

        const signalRef = db.collection('kloudNoteSignals').doc(finalShortCode);
        
        transaction.set(noteRef, {
          short_code: finalShortCode,
          content,
          password_hash: passwordHash,
          created_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        });

        transaction.set(signalRef, {
          updated_at: FieldValue.serverTimestamp(),
        });

        return true;
      });

      if (!success) {
        return NextResponse.json(
          { error: 'This custom code is already in use. Please choose another.' },
          { status: 409 }
        );
      }
    } else {
      while (attempts < SHORT_CODE.GENERATION_ATTEMPTS) {
        const candidateCode = generateShortCode();
        
        const success = await db.runTransaction(async (transaction: Transaction) => {
          const noteRef = db.collection('kloudNotes').doc(candidateCode);
          const doc = await transaction.get(noteRef);
          
          if (doc.exists) {
            return false;
          }

          const signalRef = db.collection('kloudNoteSignals').doc(candidateCode);
          
          transaction.set(noteRef, {
            short_code: candidateCode,
            content,
            password_hash: passwordHash,
            created_at: FieldValue.serverTimestamp(),
            updated_at: FieldValue.serverTimestamp(),
          });

          transaction.set(signalRef, {
            updated_at: FieldValue.serverTimestamp(),
          });

          return true;
        });

        if (success) {
          finalShortCode = candidateCode;
          break;
        }
        
        attempts++;
      }

      if (!finalShortCode) {
        return NextResponse.json(
          { error: 'Failed to generate unique short code. Please try again.' },
          { status: 500 }
        );
      }
    }

    // Generate URL and return response
    const url = generateNoteUrl(finalShortCode);

    return NextResponse.json(
      {
        shortCode: finalShortCode,
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
