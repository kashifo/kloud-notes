/**
 * API Route: POST /api/notes/[code]/relation
 * Classifies the current anonymous browser relative to the note creator.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminDb } from '@/lib/firebase-admin';
import { getClientIp } from '@/lib/security';
import { checkRateLimit, fetchNoteRateLimit } from '@/lib/ratelimit';

const relationSchema = z.object({
  visitorId: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9_-]+$/),
});

type ViewerRelation = 'creator_browser' | 'other_browser_or_device' | 'unknown';

interface ViewerRelationResponse {
  relation: ViewerRelation;
}

interface ErrorResponse {
  error: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
): Promise<NextResponse<ViewerRelationResponse | ErrorResponse>> {
  try {
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
      const { success } = await checkRateLimit(clientIp, 'relation', 30, 60000);
      if (!success) {
        return NextResponse.json(
          { error: 'Too many requests. Please try again later.' },
          { status: 429 }
        );
      }
    }

    const { code } = await params;
    if (!code) {
      return NextResponse.json({ error: 'Short code is required' }, { status: 400 });
    }

    const body = await request.json();
    const validation = relationSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid visitor id' }, { status: 400 });
    }

    const db = getAdminDb();
    const docSnap = await db.collection('kloudNotes').doc(code).get();
    if (!docSnap.exists) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    const creatorVisitorId = docSnap.data()?.created_by_visitor_id;
    if (typeof creatorVisitorId !== 'string' || !creatorVisitorId) {
      return NextResponse.json({ relation: 'unknown' }, { status: 200 });
    }

    return NextResponse.json(
      {
        relation: creatorVisitorId === validation.data.visitorId
          ? 'creator_browser'
          : 'other_browser_or_device',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Unexpected error in POST /api/notes/[code]/relation:', error);
    return NextResponse.json({ error: 'An unexpected error occurred. Please try again.' }, { status: 500 });
  }
}

