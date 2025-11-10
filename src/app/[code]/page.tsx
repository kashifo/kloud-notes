/**
 * Dynamic route for viewing notes by short code
 */

'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/Spinner';
import { PasswordDialog } from '@/components/PasswordDialog';
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
        setShowPasswordDialog(false);
      } else {
        setPasswordError('Incorrect password. Please try again.');
      }
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to verify password');
    } finally {
      setIsVerifying(false);
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-gray-600">Loading note...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">📝</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Note Not Found</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="bg-blue-600 text-white py-2 px-6 rounded-lg font-medium hover:bg-blue-700 transition"
          >
            Create a New Note
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => router.push('/')}
            className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2"
          >
            ← Create New Note
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Note</h1>
              {note && (
                <p className="text-sm text-gray-500">
                  Created {formatDate(note.created_at)}
                  {note.has_password && ' • Password Protected 🔒'}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCopyLink}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
              >
                {copied ? '✓ Copied!' : 'Copy Link'}
              </button>
              {note?.content && (
                <button
                  onClick={handleCopyContent}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                >
                  Copy Content
                </button>
              )}
            </div>
          </div>

          {note?.content ? (
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 break-words">
                {note.content}
              </pre>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🔒</div>
              <p className="text-gray-600">This note is password protected</p>
            </div>
          )}
        </div>

        <footer className="mt-12 text-center text-sm text-gray-600">
          <p>
            Share this link to let others view your note
          </p>
        </footer>
      </div>

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
