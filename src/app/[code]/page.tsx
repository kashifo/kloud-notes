import NotePageClient from './NotePageClient';
import { supabase } from '@/lib/supabase';
import { TABLES } from '@/lib/constants';
import { notFound } from 'next/navigation';

export default async function NotePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  // Server-side fetch
  const { data: note, error } = await supabase
    .from(TABLES.NOTES)
    .select('*')
    .eq('short_code', code)
    .single();

  if (error || !note) {
    notFound();
  }

  const publicNote = {
    id: note.id,
    short_code: note.short_code,
    content: note.password_hash ? '' : note.content, // Hide content if password protected
    has_password: !!note.password_hash,
    created_at: note.created_at,
    updated_at: note.updated_at,
  };

  return <NotePageClient initialNote={publicNote} code={code} />;
}
