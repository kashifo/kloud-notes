'use client';

import { useState, FormEvent, useEffect, useCallback } from 'react';
import { Spinner } from '@/components/Spinner';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PasswordDialog } from '@/components/PasswordDialog';
import { SuccessDialog } from '@/components/SuccessDialog';
import { APP_URL } from '@/lib/constants';
import type { CreateNoteResponse, ErrorResponse, PublicNote, VerifyPasswordResponse } from '@/types/note';

export default function Home() {
  const [content, setContent] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [noteUrl, setNoteUrl] = useState('');
  const [copied, setCopied] = useState(false);

  // Password protection
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);

  // Loading existing note
  const [noteCode, setNoteCode] = useState<string | null>(null);
  const [isLoadingNote, setIsLoadingNote] = useState(false);

  const appUrl = typeof window !== 'undefined' ? window.location.origin : APP_URL;

  // Check if we're on a note page
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const code = path.substring(1); // Remove leading slash
      if (code && code !== '') {
        setNoteCode(code);
        setCustomCode(code);
        loadNote(code);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadNote = useCallback(async (code: string) => {
    try {
      setIsLoadingNote(true);
      setError(null);

      const response = await fetch(`/api/notes/${code}`);
      const data: PublicNote | ErrorResponse = await response.json();

      if (!response.ok) {
        throw new Error('error' in data ? data.error : 'Failed to fetch note');
      }

      if ('content' in data) {
        if (data.has_password && !data.content) {
          setHasPassword(true);
          setShowPasswordDialog(true);
        } else {
          setContent(data.content);
          setHasPassword(data.has_password);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load note');
    } finally {
      setIsLoadingNote(false);
    }
  }, []);

  const handlePasswordSubmit = async (pwd: string) => {
    if (!noteCode) return;

    try {
      setIsVerifying(true);
      setPasswordError(null);

      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shortCode: noteCode,
          password: pwd,
        }),
      });

      const data: VerifyPasswordResponse | ErrorResponse = await response.json();

      if (!response.ok || ('error' in data)) {
        throw new Error('error' in data ? data.error : 'Invalid password');
      }

      if ('valid' in data && data.valid && data.note) {
        setContent(data.note.content);
        setPassword(pwd);
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!content.trim()) {
      setError('Please enter some content for your note');
      return;
    }

    setIsLoading(true);

    try {
      if (noteCode) {
        // Update existing note
        const response = await fetch(`/api/notes/${noteCode}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: content.trim(),
            password: password || undefined,
          }),
        });

        const data: PublicNote | ErrorResponse = await response.json();

        if (!response.ok) {
          throw new Error('error' in data ? data.error : 'Failed to update note');
        }

        const url = `${appUrl}/${noteCode}`;
        setNoteUrl(url);
        setShowSuccessDialog(true);
      } else {
        // Create new note
        const response = await fetch('/api/notes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: content.trim(),
            password: password || undefined,
            customCode: customCode || undefined,
          }),
        });

        const data: CreateNoteResponse | ErrorResponse = await response.json();

        if (!response.ok) {
          throw new Error('error' in data ? data.error : 'Failed to create note');
        }

        if ('url' in data) {
          localStorage.setItem(`note_${data.shortCode}`, 'owner');
          setNoteUrl(data.url);
          setNoteCode(data.shortCode);
          setCustomCode(data.shortCode);
          setShowSuccessDialog(true);

          // Update URL without reload
          window.history.pushState({}, '', `/${data.shortCode}`);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = async () => {
    const url = `${appUrl}/${customCode || noteCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handlePasswordToggle = () => {
    if (hasPassword || password) {
      setShowPasswordDialog(true);
    } else {
      setShowPasswordDialog(true);
    }
  };

  const handlePasswordDialogSubmit = async (pwd: string) => {
    if (noteCode && hasPassword) {
      // Verifying existing password
      await handlePasswordSubmit(pwd);
    } else {
      // Setting new password
      setPassword(pwd);
      setHasPassword(true);
      setShowPasswordDialog(false);
    }
  };

  const charCount = content.length;

  if (isLoadingNote) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Branding */}
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Kloud Notes
            </h1>

            {/* Right: Lock icon, Copy Link, Theme Toggle */}
            <div className="flex items-center gap-2">
              {(noteCode || customCode) && (
                <button
                  onClick={handleCopyLink}
                  className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition font-medium"
                >
                  {copied ? '✓ Copied' : '🔗 Copy Link'}
                </button>
              )}
              <button
                onClick={handlePasswordToggle}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition relative"
                aria-label="Password protection"
              >
                <span className="text-xl">{hasPassword || password ? '🔒' : '🔓'}</span>
                {(hasPassword || password) && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900"></span>
                )}
              </button>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex flex-col max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 overflow-hidden">
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-4 overflow-hidden">
            {/* Custom Link Input */}
            <div className="flex flex-col sm:flex-row sm:items-end gap-3 justify-between">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Create your custom link
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    {appUrl}/
                  </span>
                  <input
                    type="text"
                    value={customCode}
                    onChange={(e) => setCustomCode(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent outline-none transition"
                    placeholder="type here"
                    disabled={isLoading || !!noteCode}
                  />
                </div>
              </div>

              {/* Save Button */}
              <button
                type="submit"
                disabled={isLoading || !content.trim()}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center shadow-lg shadow-blue-500/30 dark:shadow-blue-500/20 whitespace-nowrap"
              >
                {isLoading ? <Spinner size="sm" /> : noteCode ? 'Update' : 'Save'}
              </button>
            </div>

            {/* Editor */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="flex-1 w-full p-4 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent outline-none transition resize-none font-mono text-sm overflow-auto"
                placeholder="Start typing your note here..."
                disabled={isLoading}
              />
              <div className="flex justify-end items-center mt-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {charCount.toLocaleString()} characters
                </span>
              </div>
            </div>

            {/* Error Messages */}
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 py-4 text-center bg-white dark:bg-gray-900">
        <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 px-4">
          Create notes from anywhere <span className="mx-2">•</span> Share with your link <span className="mx-2">•</span> No login required
        </p>
      </footer>

      {showPasswordDialog && (
        <PasswordDialog
          onSubmit={handlePasswordDialogSubmit}
          error={passwordError || undefined}
          isLoading={isVerifying}
          mode={noteCode && hasPassword ? 'verify' : 'set'}
        />
      )}

      {showSuccessDialog && (
        <SuccessDialog
          url={noteUrl}
          onClose={() => setShowSuccessDialog(false)}
        />
      )}
    </div>
  );
}
