/**
 * API route to check if a short code is available
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { TABLES } from '@/lib/constants';

/**
 * GET handler to check if a short code is available
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
): Promise<NextResponse> {
  try {
    const { code } = await params;

    if (!code || code.trim() === '') {
      return NextResponse.json(
        { available: false, error: 'Code is required' },
        { status: 400 }
      );
    }

    // Check if code exists in database
    const { data, error } = await supabase
      .from(TABLES.NOTES)
      .select('short_code')
      .eq('short_code', code)
      .maybeSingle();

    if (error) {
      console.error('Error checking code availability:', error);
      return NextResponse.json(
        { available: false, error: 'Failed to check code availability' },
        { status: 500 }
      );
    }

    // If data exists, code is taken
    return NextResponse.json({ available: !data }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error in check route:', error);
    return NextResponse.json(
      { available: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
