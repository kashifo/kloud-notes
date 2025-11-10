/**
 * Dynamic route for viewing and editing notes by short code
 */

'use client';

import { useState, useEffect, useCallback, use, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/Spinner';
import { PasswordDialog } from '@/components/PasswordDialog';
import { ThemeToggle } from '@/components/ThemeToggle';
import { formatDate } from '@/lib/utils';
import type { PublicNote, ErrorResponse, VerifyPasswordResponse } from '@/types/note';

export default function NotePage({ params }: { params: Promise<{ code: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const { code } = resolvedParams;

  const [note, setNote] = useState<PublicNote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [copied, setCopied] = useState(false);

  // Edit mode states
  const [isEditMode, setIsEditMode] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [showPasswordEdit, setShowPasswordEdit] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Check if user is owner
  const [isOwner, setIsOwner] = useState(false);

  const fetchNote = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/notes/${code}`);
      const data: PublicNote | ErrorResponse = await response.json();

      if (!response.ok) {
        throw new Error('error' in data ? data.error : 'Failed to fetch note');
      }

      if ('content' in data) {
        setNote(data);
        setEditContent(data.content);
        setShowPasswordEdit(data.has_password);

        // Check if user is owner
        const ownerKey = localStorage.getItem(`note_${code}`);
        setIsOwner(ownerKey === 'owner');

        // If note is password protected and has no content, show password dialog
        if (data.has_password && !data.content) {
          setShowPasswordDialog(true);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [code]);

  useEffect(() => {
    fetchNote();
  }, [fetchNote]);

  const handlePasswordSubmit = async (password: string) => {
    try {
      setIsVerifying(true);
      setPasswordError(null);

      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shortCode: code,
          password,
        }),
      });

      const data: VerifyPasswordResponse | ErrorResponse = await response.json();

      if (!response.ok || ('error' in data)) {
        throw new Error('error' in data ? data.error : 'Invalid password');
      }

      if ('valid' in data && data.valid && data.note) {
        setNote(data.note);
        setEditContent(data.note.content);
        setShowPasswordDialog(false);
        setEditPassword(password); // Save password for editing
      } else {
        setPasswordError('Incorrect password. Please try again.');
      }
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to verify password');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleEdit = () => {
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditContent(note?.content || '');
    setSaveSuccess(false);
  };

  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault();

    if (!editContent.trim()) {
      setError('Note content cannot be empty');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const response = await fetch(`/api/notes/${code}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: editContent.trim(),
          password: editPassword || undefined,
        }),
      });

      const data: PublicNote | ErrorResponse = await response.json();

      if (!response.ok) {
        throw new Error('error' in data ? data.error : 'Failed to update note');
      }

      if ('content' in data) {
        setNote(data);
        setEditContent(data.content);
        setIsEditMode(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const handleCopyContent = async () => {
    if (note?.content) {
      try {
        await navigator.clipboard.writeText(note.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy content:', err);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading note...</p>
        </div>
      </div>
    );
  }

  if (error && !note) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">📝</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Note Not Found</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white py-2 px-6 rounded-lg font-medium transition"
          >
            Create a New Note
          </button>
        </div>
      </div>
    );
  }

  const charCount = editContent.length;
  const maxChars = 10000;

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Branding & Back */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/')}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium text-sm transition"
              >
                ← New Note
              </button>
              <div className="h-6 w-px bg-gray-300 dark:bg-gray-700" />
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  Kloud Notes
                </h1>
                {note && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(note.created_at)}
                    {note.has_password && ' • 🔒'}
                  </p>
                )}
              </div>
            </div>

            {/* Right: Actions & Theme Toggle */}
            <div className="flex items-center gap-2">
              {!isEditMode && (
                <>
                  <button
                    onClick={handleCopyLink}
                    className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition font-medium"
                  >
                    {copied ? '✓ Copied' : 'Copy Link'}
                  </button>
                  {note?.content && !isEditMode && (
                    <>
                      <button
                        onClick={handleCopyContent}
                        className="hidden sm:block px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition font-medium"
                      >
                        Copy Content
                      </button>
                      {isOwner && (
                        <button
                          onClick={handleEdit}
                          className="px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg transition font-medium"
                        >
                          Edit
                        </button>
                      )}
                    </>
                  )}
                </>
              )}
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isEditMode ? (
          /* Edit Mode */
          <form onSubmit={handleSaveEdit} className="h-full flex flex-col gap-4">
            <div className="flex-1 flex flex-col">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="flex-1 w-full p-4 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent outline-none transition resize-none font-mono text-sm min-h-[400px] lg:min-h-[500px]"
                placeholder="Start typing your note here..."
                disabled={isSaving}
              />
              <div className="flex justify-between items-center mt-2 text-sm">
                <button
                  type="button"
                  onClick={() => setShowPasswordEdit(!showPasswordEdit)}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition"
                >
                  {showPasswordEdit ? '🔓 Remove password' : '🔒 Protect with password'}
                </button>
                <span className={`${charCount > maxChars ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  {charCount.toLocaleString()} / {maxChars.toLocaleString()}
                </span>
              </div>
            </div>

            {showPasswordEdit && note?.has_password && (
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                <label htmlFor="editPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Password (required to save)
                </label>
                <input
                  type="password"
                  id="editPassword"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent outline-none transition"
                  placeholder="Enter the note password"
                  disabled={isSaving}
                  required
                />
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={isSaving}
                className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-3 px-6 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || !editContent.trim() || charCount > maxChars}
                className="flex-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white py-3 px-6 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center shadow-lg shadow-blue-500/30 dark:shadow-blue-500/20"
              >
                {isSaving ? <Spinner size="sm" /> : 'Save Changes'}
              </button>
            </div>
          </form>
        ) : (
          /* View Mode */
          <div className="space-y-4">
            {saveSuccess && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm text-green-600 dark:text-green-400">✓ Note saved successfully!</p>
              </div>
            )}

            {note?.content ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 min-h-[400px]">
                <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 dark:text-gray-200 break-words">
                  {note.content}
                </pre>
              </div>
            ) : (
              <div className="text-center py-24">
                <div className="text-6xl mb-4">🔒</div>
                <p className="text-gray-600 dark:text-gray-400">This note is password protected</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 py-4 text-center">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Share this link to let others view your note
        </p>
      </footer>

      {showPasswordDialog && (
        <PasswordDialog
          onSubmit={handlePasswordSubmit}
          error={passwordError || undefined}
          isLoading={isVerifying}
        />
      )}
    </div>
  );
}
