'use client';

import { useState, FormEvent, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { firestore } from '@/lib/firebase-client';
import { doc, onSnapshot } from 'firebase/firestore';
import { Spinner } from '@/components/Spinner';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PasswordDialog } from '@/components/PasswordDialog';
import { SuccessDialog } from '@/components/SuccessDialog';
import { formatDate } from '@/lib/utils';
import { APP_URL } from '@/lib/constants';
import { FilePlus, Lock, Unlock, Link as LinkIcon, Check } from 'lucide-react';
import type { PublicNote, ErrorResponse, VerifyPasswordResponse, CreateNoteResponse } from '@/types/note';

type NoteEditorMode = 'create' | 'edit';

interface NoteEditorClientProps {
  mode: NoteEditorMode;
  code?: string;
  initialNote?: PublicNote;
}

export function NoteEditorClient({ mode, code, initialNote }: NoteEditorClientProps) {
  // Shared state
  const [content, setContent] = useState(initialNote?.content || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [noteUrl, setNoteUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [hasServerChanges, setHasServerChanges] = useState(false);

  // Note State (Edit mode only)
  const [note, setNote] = useState<PublicNote | undefined>(initialNote);

  // Custom code (Create mode only)
  const [customCode, setCustomCode] = useState('');
  const [isCheckingCode, setIsCheckingCode] = useState(false);
  const [codeAvailable, setCodeAvailable] = useState<boolean | null>(null);
  const checkTimeout = useRef<NodeJS.Timeout | null>(null);

  // Password state
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [passwordDialogMode, setPasswordDialogMode] = useState<'set' | 'verify'>('verify');
  const [newPassword, setNewPassword] = useState('');
  const [removedPasswordFlag, setRemovedPasswordFlag] = useState(false);
  const [hasPassword, setHasPassword] = useState(initialNote?.has_password || false);

  const appUrl = typeof window !== 'undefined' ? window.location.origin : APP_URL;

  // Edit mode: Show verify password dialog if note is protected and has no content initially
  useEffect(() => {
    if (mode === 'edit' && initialNote?.has_password && !initialNote.content) {
      setPasswordDialogMode('verify');
      setShowPasswordDialog(true);
    }
  }, [mode, initialNote]);

  // Edit mode: Realtime updates via Firestore
  useEffect(() => {
    if (mode !== 'edit' || !code) return;

    const unsubscribe = onSnapshot(doc(firestore, 'kloudNoteSignals', code), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.updated_at) {
          const serverDate = typeof data.updated_at?.toDate === 'function' 
            ? data.updated_at.toDate() 
            : new Date(data.updated_at);
          const localDate = note?.updated_at ? new Date(note.updated_at) : new Date(0);
          
          // Only trigger if the server date is significantly newer (e.g. > 5 seconds)
          // This prevents the author from seeing a reload banner for their own updates
          if (serverDate.getTime() - localDate.getTime() > 5000) {
            setHasServerChanges(true);
          }
        }
      }
    });

    return () => unsubscribe();
  }, [mode, code, note?.updated_at]);

  // Create mode: Check if custom code is available
  const checkCodeAvailability = useCallback(async (c: string) => {
    if (!c || c.length < 6) {
      setCodeAvailable(null);
      return;
    }

    setIsCheckingCode(true);
    try {
      const response = await fetch(`/api/check/${c}`);
      const data = await response.json();
      setCodeAvailable(data.available);
    } catch (err) {
      console.error('Error checking code availability:', err);
      setCodeAvailable(null);
    } finally {
      setIsCheckingCode(false);
    }
  }, []);

  const handleCustomCodeChange = (value: string) => {
    if (mode !== 'create') return;
    
    const sanitized = value.replace(/[^a-zA-Z0-9_-]/g, '');
    setCustomCode(sanitized);

    // Clear previous timeout
    if (checkTimeout.current) {
      clearTimeout(checkTimeout.current);
    }

    // Debounce the availability check
    if (sanitized && sanitized.length >= 6) {
      checkTimeout.current = setTimeout(() => {
        checkCodeAvailability(sanitized);
      }, 500);
    } else {
      setCodeAvailable(null);
    }
  };

  const handlePasswordSubmit = async (pwd: string) => {
    if (passwordDialogMode === 'verify' && mode === 'edit' && code) {
      // Verifying existing password
      try {
        setIsVerifying(true);
        setPasswordError(null);

        const response = await fetch('/api/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shortCode: code, password: pwd }),
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
      // Setting new password (Create or Edit)
      if (mode === 'edit' && initialNote?.has_password && password) {
        setNewPassword(pwd);
      } else {
        setPassword(pwd);
      }
      setHasPassword(true);
      setShowPasswordDialog(false);
      setRemovedPasswordFlag(false);
    }
  };

  const handlePasswordRemove = async () => {
    if (mode === 'edit') {
      setRemovedPasswordFlag(true);
    }
    setNewPassword('');
    if (mode === 'create') {
      setPassword('');
    }
    setHasPassword(false);
    setShowPasswordDialog(false);
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
      if (mode === 'edit' && code) {
        // Update existing note
        const response = await fetch(`/api/notes/${code}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: content.trim(),
            password: password || undefined,
            newPassword: newPassword || undefined,
            removePassword: removedPasswordFlag || undefined,
          }),
        });

        const data: PublicNote | ErrorResponse = await response.json();

        if (!response.ok) {
          throw new Error('error' in data ? data.error : 'Failed to update note');
        }

        if ('content' in data) {
          setNote(data);
          if (removedPasswordFlag) {
            setPassword('');
            setNewPassword('');
            setRemovedPasswordFlag(false);
          } else if (newPassword) {
            setPassword(newPassword);
            setNewPassword('');
          }
          setHasServerChanges(false);
          const url = `${appUrl}/${code}`;
          setNoteUrl(url);
          setShowSuccessDialog(true);
          setIsLoading(false);
        }
      } else {
        // Create new note
        const response = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
          window.location.href = `/${data.shortCode}`;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setIsLoading(false);
    }
  };

  const handleCopyLink = async () => {
    const targetCode = mode === 'edit' ? code : customCode;
    if (!targetCode) return;
    const url = `${appUrl}/${targetCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handlePasswordToggle = () => {
    if (mode === 'edit' && hasPassword && !password) {
      setPasswordDialogMode('verify');
    } else {
      setPasswordDialogMode('set');
    }
    setShowPasswordDialog(true);
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

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              {mode === 'edit' && (
                <button
                  onClick={handleNewNote}
                  className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition font-medium"
                >
                  <FilePlus className="w-4 h-4" /> New Note
                </button>
              )}
              <button
                onClick={handlePasswordToggle}
                className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition font-medium"
              >
                {hasPassword || password ? (
                  <><Lock className="w-4 h-4" /> Password Protected</>
                ) : (
                  <><Unlock className="w-4 h-4" /> Protect with Password</>
                )}
              </button>
              {((mode === 'edit' && code) || (mode === 'create' && customCode)) && (
                <button
                  onClick={handleCopyLink}
                  className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition font-medium"
                >
                  {copied ? <><Check className="w-4 h-4" /> Copied</> : <><LinkIcon className="w-4 h-4" /> Copy Link</>}
                </button>
              )}
              <button
                onClick={handlePasswordToggle}
                className="sm:hidden p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition relative"
                aria-label="Password protection"
              >
                <span className="flex items-center justify-center">
                  {hasPassword || password ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                </span>
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
          {mode === 'edit' && hasServerChanges && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 flex justify-between items-center rounded-lg mb-4 border border-yellow-200 dark:border-yellow-800">
              <span className="text-sm text-yellow-800 dark:text-yellow-200">
                This note has been updated remotely by someone else.
              </span>
              <button 
                onClick={() => window.location.reload()}
                className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                Reload to view changes
              </button>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-4 overflow-hidden">
            {/* Custom Link or Read-only URL */}
            <div className="flex flex-col sm:flex-row sm:items-end gap-3 justify-end">
              <div className="flex items-center gap-2 sm:ml-auto">
                <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                  {appUrl}/
                </span>
                
                {mode === 'create' ? (
                  <div className="relative flex-1 min-w-[120px] sm:flex-none sm:w-48">
                    <input
                      type="text"
                      value={customCode}
                      onChange={(e) => handleCustomCodeChange(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent outline-none transition font-mono text-sm"
                      placeholder="type here"
                      disabled={isLoading}
                    />
                    {isCheckingCode && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Spinner size="sm" />
                      </div>
                    )}
                    {!isCheckingCode && codeAvailable === true && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
                        <Check className="w-4 h-4" />
                      </div>
                    )}
                    {!isCheckingCode && codeAvailable === false && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500">
                        <span className="font-bold">✗</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={code || ''}
                    readOnly
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono w-40"
                  />
                )}
                
                <button
                  type="submit"
                  disabled={isLoading || !content.trim()}
                  className="px-8 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center shadow-lg shadow-blue-500/30 dark:shadow-blue-500/20 whitespace-nowrap min-w-[100px]"
                >
                  {isLoading ? <Spinner size="sm" /> : mode === 'edit' ? 'Update' : 'Save'}
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
                  {mode === 'edit' && note ? (
                    <>Created: {formatDate(note.created_at)} • Updated: {formatDate(note.updated_at)}</>
                  ) : (
                    <span>&nbsp;</span>
                  )}
                </div>
                <div className="text-gray-500 dark:text-gray-400">
                  {charCount.toLocaleString()} characters
                </div>
              </div>
            </div>

            {/* Error Messages */}
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg mt-4">
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
          hasExistingPassword={hasPassword || !!password}
        />
      )}

      {showSuccessDialog && mode === 'edit' && (
        <SuccessDialog
          url={noteUrl}
          onClose={() => setShowSuccessDialog(false)}
        />
      )}
    </div>
  );
}
