'use client';

import { useState, useEffect, useCallback, useRef, memo } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { Spinner } from '@/components/Spinner';
import { ThemeToggle } from '@/components/ThemeToggle';
import { APP_URL } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import type { CreateNoteResponse, ErrorResponse, PublicNote, VerifyPasswordResponse } from '@/types/note';

// Dynamically import heavy components that aren't always needed
const PasswordDialog = dynamic(() => import('@/components/PasswordDialog').then(mod => ({ default: mod.PasswordDialog })), {
  ssr: false,
  loading: () => null,
});

// Recents dropdown component (memoized to prevent unnecessary re-renders)
const RecentsDropdown = memo(function RecentsDropdown({ onClose, onSelect }: { onClose: () => void; onSelect: (url: string) => void }) {
  const [recents, setRecents] = useState<{ url: string; timestamp: number }[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

    // Auto-dismiss after 10 seconds
    const autoCloseTimer = setTimeout(() => {
      onClose();
    }, 10000);

    // Handle clicks outside and other interactions
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    // Add event listeners
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      clearTimeout(autoCloseTimer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleClearRecents = () => {
    localStorage.removeItem('kloud_notes_recents');
    setRecents([]);
  };

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 max-h-96 overflow-auto">
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
  );
});

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
  const [isNewNote, setIsNewNote] = useState(true); // Track if this is a new note created in this session
  const [recentsCount, setRecentsCount] = useState(0);
  const [isInitialLoad, setIsInitialLoad] = useState(true); // Track if we're still loading initial content

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

  // Update recents count
  const updateRecentsCount = useCallback(() => {
    try {
      const savedRecents = localStorage.getItem('kloud_notes_recents');
      if (savedRecents) {
        const recents: { url: string; timestamp: number }[] = JSON.parse(savedRecents);
        setRecentsCount(recents.length);
      } else {
        setRecentsCount(0);
      }
    } catch (e) {
      console.error('Failed to read recents count', e);
      setRecentsCount(0);
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
      updateRecentsCount();
    } catch (e) {
      console.error('Failed to save to recents', e);
    }
  }, [updateRecentsCount]);

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
          // Keep isInitialLoad as true - will be set to false on first user edit
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

      // Regular auto-save (PATCH existing note)
      const body: { content: string; password?: string; newShortCode?: string } = {
        content: content.trim(),
      };

      if (password) {
        body.password = password;
      }

      // Check if custom code has changed and this is a new note created in this session
      if (isNewNote && customCode !== noteCode && codeAvailable === true) {
        body.newShortCode = customCode;
      }

      const response = await fetch(`/api/notes/${noteCode}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data: PublicNote | ErrorResponse = await response.json();

      if (!response.ok) {
        throw new Error('error' in data ? data.error : 'Failed to save note');
      }

      if ('content' in data) {
        setNoteData(data);
        setShowSaved(true);

        // If short code was updated, update the URL and state
        if (body.newShortCode && data.short_code !== noteCode) {
          setNoteCode(data.short_code);
          window.history.pushState({}, '', `/${data.short_code}`);
          saveToRecents(`${appUrl}/${data.short_code}`);
        }
      }
    } catch (err) {
      console.error('Auto-save failed:', err);
    } finally {
      setIsSaving(false);
    }
  }, [content, noteCode, password, isNewNote, customCode, codeAvailable, saveToRecents, appUrl]);

  // Initialize - check if we're on a note page
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Update recents count on mount
      updateRecentsCount();

      const path = window.location.pathname;
      const code = path.substring(1);
      if (code && code !== '') {
        // Loading an existing note from URL
        setNoteCode(code);
        setCustomCode(code);
        setIsNewNote(false); // This is an existing note, not a new one
        loadNote(code);
      } else {
        // Creating a new note
        setIsNewNote(true);
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

    // Only auto-save if:
    // 1. Note already exists (has noteCode)
    // 2. Has content
    // 3. Initial load is complete (to avoid saving on load)
    if (noteCode && content.trim() && !isInitialLoad) {
      autoSaveTimeout.current = setTimeout(() => {
        autoSave();
      }, 300); // Auto-save after 300ms of no typing (immediate feedback)
    }

    return () => {
      if (autoSaveTimeout.current) {
        clearTimeout(autoSaveTimeout.current);
      }
    };
  }, [content, noteCode, autoSave, isInitialLoad]);

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
        // Keep isInitialLoad as true - will be set to false on first user edit
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
  const createNote = async (noteContent?: string) => {
    const contentToSave = noteContent !== undefined ? noteContent : content;
    if (!contentToSave.trim()) {
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
          content: contentToSave.trim(),
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

        // Update URL without reload
        window.history.pushState({}, '', `/${data.shortCode}`);

        // Save to recents
        saveToRecents(data.url);

        // Mark initial load as complete (we're done with the first save)
        setIsInitialLoad(false);

        // Keep isNewNote as true since this note was created in this session

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
    const newValue = e.target.value;
    setContent(newValue);

    // Mark initial load as complete when user types
    if (isInitialLoad) {
      setIsInitialLoad(false);
    }

    // Trigger auto-save for existing notes (handled by useEffect)
    // For new notes, save on first keystroke/paste
    if (!noteCode && newValue.trim() && !isSaving) {
      createNote(newValue);
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

  // Handle custom code change (only for new notes created in this session)
  const handleCustomCodeChange = (value: string) => {
    // Only allow changes for notes created in this session
    // Even after auto-save, if it's a new note (not loaded from URL), allow editing
    if (!isNewNote) return;

    const sanitized = value.replace(/[^a-zA-Z0-9_-]/g, '');
    setCustomCode(sanitized);

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

  // Handle new note
  const handleNewNote = () => {
    window.location.href = '/';
  };

  // Handle recent note selection
  const handleRecentSelect = (url: string) => {
    window.location.href = url;
  };

  const charCount = content.length;
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  if (isLoadingNote) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-900 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Branding */}
            <Link href="/" className="flex items-center gap-3 group">
              <Image
                src="/kloudnotes-logo-trans.png"
                alt="Kloud Notes Logo"
                width={32}
                height={32}
                priority
                className="dark:invert-0 invert group-hover:opacity-80 transition"
              />
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

              {recentsCount > 1 && (
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
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {appUrl}/
                  </span>
                  <div className="relative">
                    <input
                      type="text"
                      value={customCode}
                      onChange={(e) => handleCustomCodeChange(e.target.value)}
                      className={`px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent outline-none transition text-sm ${
                        isNewNote && codeAvailable === false
                          ? 'border-red-500 dark:border-red-500'
                          : isNewNote && codeAvailable === true
                          ? 'border-green-500 dark:border-green-500'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                      placeholder="custom-link"
                      readOnly={!isNewNote}
                    />
                    {isCheckingCode && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Spinner size="sm" />
                      </div>
                    )}
                    {isNewNote && !isCheckingCode && codeAvailable === true && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 font-bold">
                        ✓
                      </div>
                    )}
                    {isNewNote && !isCheckingCode && codeAvailable === false && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 font-bold">
                        ✗
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleCopyLink}
                  className="px-4 py-2 text-sm text-green-600 dark:text-green-400 font-medium flex items-center gap-2"
                >
                  {copied ? (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy Link
                    </>
                  )}
                </button>
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
                    <span className="text-green-600 dark:text-white flex items-center gap-1">
                      <span>☁️</span>
                      <span>Saved to cloud</span>
                    </span>
                  )}
                  {noteData && !isNewNote && !showSaved && (
                    <span className="text-gray-500 dark:text-gray-400 text-xs">
                      Created: {formatDate(noteData.created_at)} • Updated: {formatDate(noteData.updated_at)}
                    </span>
                  )}
                </div>
                <span className="text-gray-500 dark:text-gray-400">
                  {wordCount.toLocaleString()} words • {charCount.toLocaleString()} characters
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
      <footer className="border-t border-gray-200 dark:border-gray-800 py-4 text-center bg-gray-100 dark:bg-gray-900">
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
