/**
 * API route to check if a short code is available
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { SHORT_CODE } from '@/lib/constants';
import { getClientIp } from '@/lib/security';
import { fetchNoteRateLimit, checkRateLimit } from '@/lib/ratelimit';

/**
 * GET handler to check if a short code is available
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
): Promise<NextResponse> {
  try {
    const { code } = await params;

    if (!code || code.length < SHORT_CODE.MIN_LENGTH || code.length > SHORT_CODE.CUSTOM_MAX_LENGTH || !/^[a-zA-Z0-9_-]+$/.test(code)) {
      return NextResponse.json(
        { available: false, error: 'Invalid code format' },
        { status: 400 }
      );
    }

    // Rate limiting
    const clientIp = getClientIp(request.headers);
    if (fetchNoteRateLimit) {
      const { success } = await fetchNoteRateLimit.limit(clientIp);
      if (!success) {
        return NextResponse.json({ available: false, error: 'Too many requests' }, { status: 429 });
      }
    } else {
      const { success } = await checkRateLimit(clientIp, 30, 60000);
      if (!success) {
        return NextResponse.json({ available: false, error: 'Too many requests' }, { status: 429 });
      }
    }

    // Check if code exists in database
    const db = getAdminDb();
    const docRef = db.collection('kloudNotes').doc(code);
    const docSnap = await docRef.get();

    // If doc exists, code is taken
    return NextResponse.json({ available: !docSnap.exists }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error in check route:', error);
    return NextResponse.json(
      { available: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
