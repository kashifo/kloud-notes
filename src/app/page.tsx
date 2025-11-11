'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Spinner } from '@/components/Spinner';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PasswordDialog } from '@/components/PasswordDialog';
import { APP_URL } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import type { CreateNoteResponse, ErrorResponse, PublicNote, VerifyPasswordResponse } from '@/types/note';

// Recents dropdown component
function RecentsDropdown({ onClose, onSelect }: { onClose: () => void; onSelect: (url: string) => void }) {
  const [recents, setRecents] = useState<{ url: string; timestamp: number }[]>([]);

  useEffect(() => {
    const savedRecents = localStorage.getItem('kloud_notes_recents');
    if (savedRecents) {
      try {
        const parsed: { url: string; timestamp: number }[] = JSON.parse(savedRecents);
        setRecents(parsed.sort((a, b) => b.timestamp - a.timestamp));
      } catch (e) {
        console.error('Failed to parse recents', e);
      }
    }
  }, []);

  const handleClearRecents = () => {
    localStorage.removeItem('kloud_notes_recents');
    setRecents([]);
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose}></div>
      <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 max-h-96 overflow-auto">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h3 className="font-semibold text-gray-900 dark:text-white">Recent Notes</h3>
          {recents.length > 0 && (
            <button
              onClick={handleClearRecents}
              className="text-xs text-red-600 dark:text-red-400 hover:underline"
            >
              Clear All
            </button>
          )}
        </div>
        {recents.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
            No recent notes yet
          </div>
        ) : (
          <div className="p-2">
            {recents.map((recent, index) => (
              <button
                key={index}
                onClick={() => {
                  onSelect(recent.url);
                  onClose();
                }}
                className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300 truncate block"
              >
                {recent.url}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default function Home() {
  const [content, setContent] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Auto-save state
  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const autoSaveTimeout = useRef<NodeJS.Timeout | null>(null);

  // Password protection
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);

  // Note state
  const [noteCode, setNoteCode] = useState<string | null>(null);
  const [noteData, setNoteData] = useState<PublicNote | null>(null);
  const [isLoadingNote, setIsLoadingNote] = useState(false);

  // UI state
  const [showCustomLinkRow, setShowCustomLinkRow] = useState(false);
  const [showRecents, setShowRecents] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newCode, setNewCode] = useState('');

  // Code availability checking
  const [isCheckingCode, setIsCheckingCode] = useState(false);
  const [codeAvailable, setCodeAvailable] = useState<boolean | null>(null);
  const checkTimeout = useRef<NodeJS.Timeout | null>(null);

  const appUrl = typeof window !== 'undefined' ? window.location.origin : APP_URL;

  // Generate a unique short code
  const generateUniqueCode = useCallback(async () => {
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      const code = Math.random().toString(36).substring(2, 10);

      try {
        const response = await fetch(`/api/check/${code}`);
        const data = await response.json();

        if (data.available) {
          return code;
        }
      } catch (err) {
        console.error('Error checking code availability:', err);
      }

      attempts++;
    }

    return Date.now().toString(36);
  }, []);

  // Check if code is available
  const checkCodeAvailability = useCallback(async (code: string) => {
    if (!code || code.length < 3) {
      setCodeAvailable(null);
      return;
    }

    setIsCheckingCode(true);
    try {
      const response = await fetch(`/api/check/${code}`);
      const data = await response.json();
      setCodeAvailable(data.available);
    } catch (err) {
      console.error('Error checking code availability:', err);
      setCodeAvailable(null);
    } finally {
      setIsCheckingCode(false);
    }
  }, []);

  // Save to recents
  const saveToRecents = useCallback((url: string) => {
    try {
      const savedRecents = localStorage.getItem('kloud_notes_recents');
      let recents: { url: string; timestamp: number }[] = savedRecents ? JSON.parse(savedRecents) : [];

      // Remove duplicate if exists
      recents = recents.filter(r => r.url !== url);

      // Add new entry at the beginning
      recents.unshift({ url, timestamp: Date.now() });

      // Keep only last 10
      recents = recents.slice(0, 10);

      localStorage.setItem('kloud_notes_recents', JSON.stringify(recents));
    } catch (e) {
      console.error('Failed to save to recents', e);
    }
  }, []);

  // Load note
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
        setNoteData(data);
        if (data.has_password && !data.content) {
          setHasPassword(true);
          setShowPasswordDialog(true);
        } else {
          setContent(data.content);
          setHasPassword(data.has_password);
          saveToRecents(`${appUrl}/${code}`);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load note');
    } finally {
      setIsLoadingNote(false);
    }
  }, [appUrl, saveToRecents]);

  // Auto-save function
  const autoSave = useCallback(async () => {
    if (!content.trim() || !noteCode) return;

    try {
      setIsSaving(true);
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
        throw new Error('error' in data ? data.error : 'Failed to save note');
      }

      if ('content' in data) {
        setNoteData(data);
        setShowSaved(true);
        setTimeout(() => setShowSaved(false), 3000);
      }
    } catch (err) {
      console.error('Auto-save failed:', err);
    } finally {
      setIsSaving(false);
    }
  }, [content, noteCode, password]);

  // Initialize - check if we're on a note page
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const code = path.substring(1);
      if (code && code !== '') {
        setNoteCode(code);
        setCustomCode(code);
        loadNote(code);
      } else {
        // Auto-generate a code for new notes
        generateUniqueCode().then((generatedCode) => {
          setCustomCode(generatedCode);
          setCodeAvailable(true);
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save on content change (debounced)
  useEffect(() => {
    if (autoSaveTimeout.current) {
      clearTimeout(autoSaveTimeout.current);
    }

    // Only auto-save if note already exists
    if (noteCode && content.trim()) {
      autoSaveTimeout.current = setTimeout(() => {
        autoSave();
      }, 2000); // Auto-save after 2 seconds of no typing
    }

    return () => {
      if (autoSaveTimeout.current) {
        clearTimeout(autoSaveTimeout.current);
      }
    };
  }, [content, noteCode, autoSave]);

  // Password verification
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
        setNoteData(data.note);
        setPassword(pwd);
        setShowPasswordDialog(false);
        saveToRecents(`${appUrl}/${noteCode}`);
      } else {
        setPasswordError('Incorrect password. Please try again.');
      }
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to verify password');
    } finally {
      setIsVerifying(false);
    }
  };

  // Create new note (first save)
  const createNote = async () => {
    if (!content.trim()) {
      setError('Please enter some content for your note');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
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
        setNoteCode(data.shortCode);
        setCustomCode(data.shortCode);
        setShowSaved(true);
        setTimeout(() => setShowSaved(false), 3000);

        // Update URL without reload
        window.history.pushState({}, '', `/${data.shortCode}`);

        // Save to recents
        saveToRecents(data.url);

        // Fetch the full note data
        const noteResponse = await fetch(`/api/notes/${data.shortCode}`);
        const noteData: PublicNote | ErrorResponse = await noteResponse.json();
        if ('content' in noteData) {
          setNoteData(noteData);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle content change
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);

    // Trigger auto-save for existing notes (handled by useEffect)
    // For new notes, save on first keystroke
    if (!noteCode && e.target.value.trim() && !isSaving) {
      createNote();
    }
  };

  // Handle Get Link button click
  const handleGetLink = () => {
    setShowCustomLinkRow(!showCustomLinkRow);
  };

  // Handle copy link
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

  // Handle password toggle
  const handlePasswordToggle = () => {
    setShowPasswordDialog(true);
  };

  // Handle password dialog submit
  const handlePasswordDialogSubmit = async (pwd: string) => {
    if (noteCode && hasPassword) {
      await handlePasswordSubmit(pwd);
    } else {
      setPassword(pwd);
      setHasPassword(true);
      setShowPasswordDialog(false);
    }
  };

  // Handle password remove
  const handlePasswordRemove = async () => {
    setPassword('');
    setHasPassword(false);
    setShowPasswordDialog(false);
  };

  // Handle custom code change
  const handleCustomCodeChange = (value: string) => {
    const sanitized = value.replace(/[^a-zA-Z0-9_-]/g, '');
    setNewCode(sanitized);

    if (checkTimeout.current) {
      clearTimeout(checkTimeout.current);
    }

    if (sanitized && sanitized.length >= 3) {
      checkTimeout.current = setTimeout(() => {
        checkCodeAvailability(sanitized);
      }, 500);
    } else {
      setCodeAvailable(null);
    }
  };

  // Handle rename link
  const handleRenameLink = async () => {
    if (!newCode || newCode === customCode || codeAvailable !== true) return;

    try {
      setIsRenaming(true);
      // For now, this would require a new API endpoint to rename
      // We'll create a new note with the new code and same content
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: content.trim(),
          password: password || undefined,
          customCode: newCode,
        }),
      });

      const data: CreateNoteResponse | ErrorResponse = await response.json();

      if (!response.ok) {
        throw new Error('error' in data ? data.error : 'Failed to rename note');
      }

      if ('url' in data) {
        setNoteCode(data.shortCode);
        setCustomCode(data.shortCode);
        window.history.pushState({}, '', `/${data.shortCode}`);
        saveToRecents(data.url);
        setShowCustomLinkRow(false);
        setIsRenaming(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename link');
      setIsRenaming(false);
    }
  };

  // Handle new note
  const handleNewNote = () => {
    window.location.href = '/';
  };

  // Handle recent note selection
  const handleRecentSelect = (url: string) => {
    window.location.href = url;
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
            <Link href="/" className="flex items-center gap-3 group">
              <Image src="/kloudnotes-logo-trans.png" alt="Kloud Notes Logo" width={32} height={32} className="dark:invert-0 invert group-hover:opacity-80 transition" />
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white group-hover:text-gray-700 dark:group-hover:text-gray-300 transition">
                Kloud Notes
              </h1>
            </Link>

            {/* Right: Buttons - New Note, Recents, Get Link, Protect, Theme Toggle */}
            <div className="flex items-center gap-1 sm:gap-2">
              {noteCode && (
                <button
                  onClick={handleNewNote}
                  className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 text-xs sm:text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition font-medium"
                >
                  <span className="hidden sm:inline">📝</span>
                  <span className="hidden sm:inline">New Note</span>
                  <span className="sm:hidden">📝</span>
                </button>
              )}

              {noteCode && (
                <div className="relative">
                  <button
                    onClick={() => setShowRecents(!showRecents)}
                    className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 text-xs sm:text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition font-medium"
                  >
                    <span className="hidden sm:inline">🕒</span>
                    <span className="hidden sm:inline">Recents</span>
                    <span className="sm:hidden">🕒</span>
                  </button>
                  {showRecents && (
                    <RecentsDropdown
                      onClose={() => setShowRecents(false)}
                      onSelect={handleRecentSelect}
                    />
                  )}
                </div>
              )}

              {noteCode && (
                <button
                  onClick={handleGetLink}
                  className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 text-xs sm:text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition font-medium"
                >
                  <span className="hidden sm:inline">🔗</span>
                  <span className="hidden sm:inline">Get Link</span>
                  <span className="sm:hidden">🔗</span>
                </button>
              )}

              <button
                onClick={handlePasswordToggle}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 text-xs sm:text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition font-medium relative"
              >
                <span>{hasPassword || password ? '🔒' : '🔓'}</span>
                <span className="hidden sm:inline">{hasPassword || password ? 'Protected' : 'Protect'}</span>
                {(hasPassword || password) && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 sm:w-3 sm:h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900"></span>
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
          <div className="flex-1 flex flex-col gap-4 overflow-hidden">
            {/* Custom Link Row - Hidden by default, shown on Get Link click */}
            {showCustomLinkRow && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                  {appUrl}/
                </span>
                <div className="relative flex-1 sm:flex-none sm:w-64">
                  <input
                    type="text"
                    value={isRenaming ? newCode : customCode}
                    onChange={(e) => handleCustomCodeChange(e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent outline-none transition ${
                      codeAvailable === false
                        ? 'border-red-500 dark:border-red-500'
                        : codeAvailable === true
                        ? 'border-green-500 dark:border-green-500'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                    placeholder="Enter custom code"
                    readOnly={!isRenaming}
                    onFocus={() => {
                      if (noteCode && localStorage.getItem(`note_${noteCode}`) === 'owner') {
                        setIsRenaming(true);
                        setNewCode(customCode);
                      }
                    }}
                  />
                  {isCheckingCode && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Spinner size="sm" />
                    </div>
                  )}
                  {!isCheckingCode && codeAvailable === true && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 font-bold">
                      ✓
                    </div>
                  )}
                  {!isCheckingCode && codeAvailable === false && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 font-bold">
                      ✗
                    </div>
                  )}
                </div>

                {isRenaming && codeAvailable === true ? (
                  <button
                    onClick={handleRenameLink}
                    className="px-6 py-2 bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white rounded-lg font-medium transition flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    <span>🔗</span>
                    <span>Rename Link</span>
                  </button>
                ) : (
                  <button
                    onClick={handleCopyLink}
                    className="px-6 py-2 bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white rounded-lg font-medium transition flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    <span>🔗</span>
                    <span>{copied ? 'Copied!' : 'Copy Link'}</span>
                  </button>
                )}
              </div>
            )}

            {/* Editor */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <textarea
                value={content}
                onChange={handleContentChange}
                className="flex-1 w-full p-4 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent outline-none transition resize-none font-mono text-sm overflow-auto"
                placeholder="Start typing your note here..."
              />
              <div className="flex justify-between items-center mt-2 text-sm flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  {isSaving && (
                    <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                      <Spinner size="sm" />
                      <span>Saving...</span>
                    </span>
                  )}
                  {showSaved && !isSaving && (
                    <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                      <span>☁️</span>
                      <span>Saved to cloud</span>
                    </span>
                  )}
                  {noteData && (
                    <span className="text-gray-500 dark:text-gray-400 text-xs">
                      Updated: {formatDate(noteData.updated_at)}
                    </span>
                  )}
                </div>
                <span className="text-gray-500 dark:text-gray-400">
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
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 py-4 text-center bg-white dark:bg-gray-900">
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 px-4">
          <span className="block sm:inline">Create notes from anywhere</span>
          <span className="hidden sm:inline mx-2">•</span>
          <span className="block sm:inline">Share with your link</span>
          <span className="hidden sm:inline mx-2">•</span>
          <span className="block sm:inline">No login required</span>
        </p>
      </footer>

      {showPasswordDialog && (
        <PasswordDialog
          onSubmit={handlePasswordDialogSubmit}
          onRemove={handlePasswordRemove}
          onClose={() => setShowPasswordDialog(false)}
          error={passwordError || undefined}
          isLoading={isVerifying}
          mode={noteCode && hasPassword ? 'verify' : 'set'}
          hasExistingPassword={hasPassword || !!password}
        />
      )}
    </div>
  );
}
