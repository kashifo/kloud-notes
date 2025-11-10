'use client';

import { useState, FormEvent, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Spinner } from '@/components/Spinner';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PasswordDialog } from '@/components/PasswordDialog';
import { SuccessDialog } from '@/components/SuccessDialog';
import { formatDate } from '@/lib/utils';
import type { PublicNote, ErrorResponse, VerifyPasswordResponse } from '@/types/note';

interface NotePageClientProps {
  initialNote: PublicNote;
  code: string;
}

export default function NotePageClient({ initialNote, code }: NotePageClientProps) {
  const [content, setContent] = useState(initialNote.content);
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
  const [hasPassword, setHasPassword] = useState(initialNote.has_password);
  const [passwordDialogMode, setPasswordDialogMode] = useState<'set' | 'verify'>('verify');

  const [note, setNote] = useState<PublicNote>(initialNote);

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

  // Show password dialog if note is password protected and has no content
  useEffect(() => {
    if (initialNote.has_password && !initialNote.content) {
      setPasswordDialogMode('verify');
      setShowPasswordDialog(true);
    }
  }, [initialNote]);

  const handlePasswordSubmit = async (pwd: string) => {
    if (passwordDialogMode === 'verify') {
      // Verifying existing password
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
    } else {
      // Setting new password
      setPassword(pwd);
      setHasPassword(true);
      setShowPasswordDialog(false);
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
      const response = await fetch(`/api/notes/${code}`, {
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

      if ('content' in data) {
        setNote(data);
        const url = `${appUrl}/${code}`;
        setNoteUrl(url);
        setShowSuccessDialog(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = async () => {
    const url = `${appUrl}/${code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handlePasswordToggle = () => {
    if (hasPassword && !password) {
      // Need to verify password first
      setPasswordDialogMode('verify');
      setShowPasswordDialog(true);
    } else {
      // Setting or removing password
      setPasswordDialogMode('set');
      setShowPasswordDialog(true);
    }
  };

  const handlePasswordRemove = async () => {
    setPassword('');
    setHasPassword(false);
    setShowPasswordDialog(false);
  };

  const handleNewNote = () => {
    window.location.href = '/';
  };

  const charCount = content.length;

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Branding */}
            <Link href="/" className="flex items-center gap-3 group">
              <Image src="/kloudnotes-logo-trans.png" alt="Kloud Notes Logo" width={32} height={32} className="dark:invert-0 invert group-hover:opacity-80 transition" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white group-hover:text-gray-700 dark:group-hover:text-gray-300 transition">
                Kloud Notes
              </h1>
            </Link>

            {/* Right: New Note, Protect with Password button, Copy Link, Lock icon, Theme Toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleNewNote}
                className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition font-medium"
              >
                📝 New Note
              </button>
              <button
                onClick={handlePasswordToggle}
                className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition font-medium"
              >
                {hasPassword ? '🔒 Password Protected' : '🔓 Protect with Password'}
              </button>
              <button
                onClick={handleCopyLink}
                className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition font-medium"
              >
                {copied ? '✓ Copied' : '🔗 Copy Link'}
              </button>
              <button
                onClick={handlePasswordToggle}
                className="sm:hidden p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition relative"
                aria-label="Password protection"
              >
                <span className="text-xl">{hasPassword ? '🔒' : '🔓'}</span>
                {hasPassword && (
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
            {/* Custom Link (Read-only) and Save Button */}
            <div className="flex flex-col sm:flex-row sm:items-end gap-3 justify-end">
              <div className="flex items-center gap-2 sm:ml-auto">
                <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                  {appUrl}/
                </span>
                <input
                  type="text"
                  value={code}
                  readOnly
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono w-40"
                />
                <button
                  type="submit"
                  disabled={isLoading || !content.trim()}
                  className="px-8 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center shadow-lg shadow-blue-500/30 dark:shadow-blue-500/20 whitespace-nowrap"
                >
                  {isLoading ? <Spinner size="sm" /> : 'Update'}
                </button>
              </div>
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
              <div className="flex justify-between items-center mt-2 text-sm">
                <div className="text-gray-500 dark:text-gray-400">
                  Created: {formatDate(note.created_at)} • Updated: {formatDate(note.updated_at)}
                </div>
                <div className="text-gray-500 dark:text-gray-400">
                  {charCount.toLocaleString()} characters
                </div>
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
          <span className="block sm:inline">Create notes from anywhere</span>
          <span className="hidden sm:inline mx-2">•</span>
          <span className="block sm:inline">Share with your link</span>
          <span className="hidden sm:inline mx-2">•</span>
          <span className="block sm:inline">No login required</span>
        </p>
      </footer>

      {showPasswordDialog && (
        <PasswordDialog
          onSubmit={handlePasswordSubmit}
          onRemove={handlePasswordRemove}
          onClose={() => setShowPasswordDialog(false)}
          error={passwordError || undefined}
          isLoading={isVerifying}
          mode={passwordDialogMode}
          hasExistingPassword={hasPassword}
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
