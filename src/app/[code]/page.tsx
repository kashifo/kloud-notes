import { NoteEditorClient } from '@/components/NoteEditorClient';
import { getAdminDb } from '@/lib/firebase-admin';
import { toPublicNoteFromFirestore, RawNoteData } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function NotePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  // Server-side fetch
  const db = getAdminDb();
  const docRef = db.collection('kloudNotes').doc(code);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    return <NoteEditorClient mode="create" code={code} />;
  }

  const note = docSnap.data()!;

  const publicNote = {
    ...toPublicNoteFromFirestore(code, note as RawNoteData),
    content: note.password_hash ? '' : note.content, // Hide content if password protected
  };

  return <NoteEditorClient mode="edit" code={code} initialNote={publicNote} />;
}
