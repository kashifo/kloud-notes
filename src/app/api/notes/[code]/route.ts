/**
 * API Route: GET /api/notes/[code]
 * Fetches a note by its short code
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue, Transaction, DocumentData } from 'firebase-admin/firestore';
import { toPublicNoteFromFirestore, RawNoteData } from '@/lib/utils';
import { getClientIp, hashPassword, verifyPassword } from '@/lib/security';
import { fetchNoteRateLimit, checkRateLimit, updateNoteRateLimit } from '@/lib/ratelimit';
import { updateNoteSchema } from '@/lib/validation';
import type { PublicNote, ErrorResponse } from '@/types/note';

export const dynamic = 'force-dynamic';

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
      const { success } = await checkRateLimit(clientIp, 'fetch', 30, 60000);
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
    const db = getAdminDb();
    const docRef = db.collection('kloudNotes').doc(code);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json(
        { error: 'Note not found' },
        { status: 404 }
      );
    }

    const note = docSnap.data()!;

    // If note is password protected, don't return content
    if (note.password_hash) {
      return NextResponse.json(
        {
          ...toPublicNoteFromFirestore(code, note as RawNoteData),
          content: '', // Don't return content for password-protected notes
        },
        { status: 200 }
      );
    }

    // Return public note
    return NextResponse.json(toPublicNoteFromFirestore(code, note as RawNoteData), { status: 200 });
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

    if (updateNoteRateLimit) {
      const { success, remaining } = await updateNoteRateLimit.limit(clientIp);
      if (!success) {
        return NextResponse.json(
          { error: 'Too many requests. Please try again later.' },
          { status: 429, headers: { 'X-RateLimit-Remaining': remaining?.toString() || '0' } }
        );
      }
    } else {
      const { success } = await checkRateLimit(clientIp, 'update', 60, 60000);
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

    const { content, password, newPassword, removePassword, newCode, clientId } = validation.data;

    const db = getAdminDb();
    const noteRef = db.collection('kloudNotes').doc(code);
    const signalRef = db.collection('kloudNoteSignals').doc(code);

    let updatedNote: DocumentData | null = null;

    try {
      const success = await db.runTransaction(async (transaction: Transaction) => {
        const doc = await transaction.get(noteRef);
        if (!doc.exists) return false;
        
        const existingNote = doc.data()!;

        if (existingNote.password_hash) {
          if (!password) {
            throw new Error('PASSWORD_REQUIRED');
          }
          const isValid = await verifyPassword(password, existingNote.password_hash);
          if (!isValid) {
            throw new Error('INVALID_PASSWORD');
          }
        }

        let passwordHash = existingNote.password_hash;
        if (removePassword) {
          passwordHash = null;
        } else if (newPassword) {
          passwordHash = await hashPassword(newPassword);
        } else if (password && !existingNote.password_hash) {
          passwordHash = await hashPassword(password);
        }

        const updates = {
          content,
          password_hash: passwordHash,
          updated_at: FieldValue.serverTimestamp(),
        };

        if (newCode && newCode !== code) {
          // Verify new code is not taken
          const newNoteRef = db.collection('kloudNotes').doc(newCode);
          const newNoteDoc = await transaction.get(newNoteRef);
          
          if (newNoteDoc.exists) {
            throw new Error('CODE_ALREADY_EXISTS');
          }

          const newSignalRef = db.collection('kloudNoteSignals').doc(newCode);
          
          // Create new documents with updated values
          transaction.set(newNoteRef, {
            ...existingNote,
            ...updates,
            short_code: newCode,
          });
          
          transaction.set(newSignalRef, {
            updated_at: FieldValue.serverTimestamp(),
            updated_by: clientId ?? null,
          }, { merge: true });

          // Delete old documents
          transaction.delete(noteRef);
          transaction.delete(signalRef);

          updatedNote = {
            ...existingNote,
            ...updates,
            short_code: newCode,
            updated_at: { toDate: () => new Date() },
          };
        } else {
          // Standard update
          transaction.update(noteRef, updates);
          transaction.set(signalRef, {
            updated_at: FieldValue.serverTimestamp(),
            updated_by: clientId ?? null,
          }, { merge: true });

          updatedNote = {
            ...existingNote,
            ...updates,
            updated_at: { toDate: () => new Date() },
          };
        }

        return true;
      });

      if (!success) {
        return NextResponse.json({ error: 'Note not found' }, { status: 404 });
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === 'PASSWORD_REQUIRED') {
          return NextResponse.json({ error: 'Password is required to update a protected note' }, { status: 401 });
        }
        if (err.message === 'INVALID_PASSWORD') {
          return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
        }
        if (err.message === 'CODE_ALREADY_EXISTS') {
          return NextResponse.json({ error: 'This custom code is already in use. Please choose another.' }, { status: 409 });
        }
      }
      throw err;
    }

    return NextResponse.json(toPublicNoteFromFirestore(updatedNote!.short_code, updatedNote! as RawNoteData), { status: 200 });
  } catch (error) {
    console.error('Unexpected error in PATCH route:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
