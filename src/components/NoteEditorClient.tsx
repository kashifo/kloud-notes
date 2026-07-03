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
import { FilePlus, Lock, Unlock, Check, Clock, Edit2, Copy, X } from 'lucide-react';
import type { PublicNote, ErrorResponse, VerifyPasswordResponse, CreateNoteResponse } from '@/types/note';

type NoteEditorMode = 'create' | 'edit';

interface NoteEditorClientProps {
  mode: NoteEditorMode;
  code?: string;
  initialNote?: PublicNote;
}

interface RecentNote {
  code: string;
  preview: string;
  updatedAt: number;
}

export function NoteEditorClient({ mode: initialMode, code: initialCode, initialNote }: NoteEditorClientProps) {
  const [mode, setMode] = useState<NoteEditorMode>(initialMode);
  const [code, setCode] = useState<string | undefined>(initialCode);
  const [note, setNote] = useState<PublicNote | null>(initialMode === 'edit' && initialNote ? initialNote : null);
  // Shared state
  const [content, setContent] = useState(initialNote?.content || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [noteUrl, setNoteUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [hasServerChanges, setHasServerChanges] = useState(false);

  // Note State
  // (managed above)

  // Custom code (Create mode only)
  const [customCode, setCustomCode] = useState(initialCode || '');
  const [isCheckingCode, setIsCheckingCode] = useState(false);
  const [codeAvailable, setCodeAvailable] = useState<boolean | null>(null);
  const checkTimeout = useRef<NodeJS.Timeout | null>(null);

  const userModifiedCode = useRef(false);

  // Password state
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [passwordDialogMode, setPasswordDialogMode] = useState<'set' | 'verify'>('verify');
  const [newPassword, setNewPassword] = useState('');
  const [removedPasswordFlag, setRemovedPasswordFlag] = useState(false);
  const [hasPassword, setHasPassword] = useState(initialNote?.has_password || false);
  const [passwordChangeTrigger, setPasswordChangeTrigger] = useState(0);

  // Auto-save state
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const autoSaveTimeout = useRef<NodeJS.Timeout | null>(null);
  const [lastSavedContent, setLastSavedContent] = useState(initialNote?.content || '');

  // Recent Notes state
  const [recentNotes, setRecentNotes] = useState<RecentNote[]>([]);
  const [showRecents, setShowRecents] = useState(false);
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const recentsRef = useRef<HTMLDivElement>(null);

  const appUrl = typeof window !== 'undefined' ? window.location.origin : APP_URL;
  const clientId = useRef(`client_${Date.now()}_${Math.random().toString(36).slice(2)}`);

  // Handle clicking outside the recents popup
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (recentsRef.current && !recentsRef.current.contains(event.target as Node)) {
        setShowRecents(false);
      }
    };
    if (showRecents) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showRecents]);

  // Load Recent Notes on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('kloud_recents');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // Ensure every item is an object and has a code string
          const validRecents = parsed.filter(rn => rn && typeof rn === 'object' && typeof rn.code === 'string');
          setRecentNotes(validRecents);
        }
      }
    } catch (e) {
      console.error('Failed to load recent notes', e);
    }
  }, []);

  // Update Recent Notes list
  const addToRecents = useCallback((noteCode: string, noteContent: string) => {
    setRecentNotes(prev => {
      const preview = noteContent.substring(0, 40) + (noteContent.length > 40 ? '...' : '');
      const filtered = prev.filter(n => n.code !== noteCode);
      const updated = [{ code: noteCode, preview, updatedAt: Date.now() }, ...filtered].slice(0, 5);
      localStorage.setItem('kloud_recents', JSON.stringify(updated));
      return updated;
    });
  }, []);

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

    let hasSeenDoc = false;
    let hasProcessedInitialSnapshot = false;
    let lastSignalKey: string | null = null;
    const ownClientId = clientId.current;
    const localUpdatedAt = note?.updated_at ? new Date(note.updated_at).getTime() : 0;

    const unsubscribe = onSnapshot(doc(firestore, 'kloudNoteSignals', code), (docSnap) => {
      if (docSnap.exists()) {
        hasSeenDoc = true;
        const data = docSnap.data();
        if (data.updated_at) {
          const serverDate = typeof data.updated_at?.toDate === 'function'
            ? data.updated_at.toDate()
            : new Date(data.updated_at);
          const serverTime = serverDate.getTime();
          const updatedBy = typeof data.updated_by === 'string' ? data.updated_by : null;
          const signalKey = `${serverTime}:${updatedBy ?? ''}`;
          const isOwnSave = updatedBy === ownClientId;

          if (!hasProcessedInitialSnapshot) {
            hasProcessedInitialSnapshot = true;
            lastSignalKey = signalKey;

            if (!isOwnSave && serverTime > localUpdatedAt + 1000) {
              setHasServerChanges(true);
            }
            return;
          }

          if (signalKey === lastSignalKey) return;
          lastSignalKey = signalKey;

          if (!isOwnSave) {
            setHasServerChanges(true);
          }
        }
      } else if (hasSeenDoc) {
        // Document deleted (e.g. from rename or manual deletion) AFTER we saw it exist.
        // This protects legacy notes that don't have a signal document yet.
        setSaveError('This note has been renamed or deleted. Please refresh.');
        setHasServerChanges(true); // Stop autosaving
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
    userModifiedCode.current = true;
    const sanitized = value.replace(/[^a-zA-Z0-9_-]/g, '');
    setCustomCode(sanitized);

    if (checkTimeout.current) {
      clearTimeout(checkTimeout.current);
    }

    if (sanitized && sanitized.length >= 6 && sanitized !== code) {
      checkTimeout.current = setTimeout(() => {
        checkCodeAvailability(sanitized);
      }, 500);
    } else if (sanitized === code) {
      setCodeAvailable(null); // It's their own code, it's fine
    } else {
      setCodeAvailable(null);
    }
  };

  const handleCancelEditUrl = () => {
    setIsEditingUrl(false);
    setCustomCode(mode === 'create' ? (code || '') : '');
    setCodeAvailable(null);
  };

  const handlePasswordSubmit = async (pwd: string) => {
    if (passwordDialogMode === 'verify' && mode === 'edit' && code) {
      try {
        setIsVerifying(true);
        setPasswordError(null);

        const response = await fetch('/api/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shortCode: code, password: pwd }),
        });

        const data: VerifyPasswordResponse | ErrorResponse = await response.json();

        if (response.ok && 'valid' in data && data.valid && data.note) {
          setPassword(pwd);
          setNote(data.note);
          setContent(data.note.content);
          setLastSavedContent(data.note.content); // Prevent immediate auto-save on unlock
          setShowPasswordDialog(false);
          setHasPassword(true);
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
      if (mode === 'edit' && hasPassword && password) {
        setNewPassword(pwd);
      } else {
        setPassword(pwd);
      }
      setHasPassword(true);
      setShowPasswordDialog(false);
      setRemovedPasswordFlag(false);
      
      if (mode === 'edit') {
        setPasswordChangeTrigger(prev => prev + 1);
      }
    }
  };

  const handlePasswordRemove = async () => {
    // Only clear the password state if we are in create mode.
    // In edit mode, we must keep the original `password` to authenticate the PATCH request!
    if (mode === 'create') {
      setPassword('');
    }
    setHasPassword(false);
    setRemovedPasswordFlag(true);
    setNewPassword('');
    setShowPasswordDialog(false);
    
    if (mode === 'edit') {
      setPasswordChangeTrigger(prev => prev + 1);
    }
  };

  const handleSubmit = async (e?: FormEvent, isAutoSave = false) => {
    if (e) e.preventDefault();
    if (!isAutoSave) setError(null);

    if (!content.trim()) {
      if (!isAutoSave) setError('Please enter some content for your note');
      return;
    }

    if (isAutoSave) setIsAutoSaving(true);
    else setIsLoading(true);
      
    setError(null);
    setSaveError(null);

    try {
      if (mode === 'edit' && code) {
        const response = await fetch(`/api/notes/${code}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: content.trim(),
            password: password || undefined,
            newPassword: newPassword || undefined,
            removePassword: removedPasswordFlag || undefined,
            newCode: (customCode && customCode !== code && !isAutoSave) ? customCode : undefined,
            clientId: clientId.current,
          }),
        });

        const data: PublicNote | ErrorResponse & { message?: string } = await response.json();

        if (!response.ok) {
          const errMsg = 'message' in data && data.message ? data.message : ('error' in data ? data.error : 'Failed to update note');
          throw new Error(errMsg);
        }

        if ('content' in data) {
          setNote(data);
          setLastSavedContent(data.content);
          
          if (removedPasswordFlag) {
            setPassword('');
            setNewPassword('');
            setRemovedPasswordFlag(false);
          } else if (newPassword) {
            setPassword(newPassword);
            setNewPassword('');
          }
          setHasServerChanges(false);
          
          if (!isAutoSave) {
            // Handle redirect if renamed
            if (data.short_code && data.short_code !== code) {
              addToRecents(data.short_code, data.content);
              window.location.href = `/${data.short_code}`;
              return;
            }

            addToRecents(code, data.content);
            const url = `${appUrl}/${code}`;
            setNoteUrl(url);
            setShowSuccessDialog(true);
          } else {
            addToRecents(code, data.content);
          }
        }
      } else {
        const response = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: content.trim(),
            password: password || undefined,
            customCode: customCode || undefined,
            clientId: clientId.current,
          }),
        });

        const data: CreateNoteResponse | ErrorResponse & { message?: string } = await response.json();

        if (!response.ok) {
          const errMsg = 'message' in data && data.message ? data.message : ('error' in data ? data.error : 'Failed to create note');
          throw new Error(errMsg);
        }

        if ('url' in data) {
          addToRecents(data.shortCode, content);
          if (isAutoSave) {
            // Seamlessly upgrade client to edit mode without reloading!
            window.history.replaceState(null, '', `/${data.shortCode}`);
            setCode(data.shortCode);
            setCustomCode('');
            setMode('edit');
            setNote({
              id: data.shortCode,
              short_code: data.shortCode,
              content: content.trim(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              has_password: !!password,
            });
            setLastSavedContent(content.trim());
          } else {
            window.location.href = `/${data.shortCode}`;
          }
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      console.error('Error saving note:', err);
      if (isAutoSave) {
        setSaveError(`Auto-save failed: ${errorMessage}`);
      } else {
        setError(errorMessage);
      }
    } finally {
      if (isAutoSave) {
        setIsAutoSaving(false);
      } else {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    if (hasServerChanges) return;

    if (content !== lastSavedContent || passwordChangeTrigger > 0) {
        if (autoSaveTimeout.current) {
          clearTimeout(autoSaveTimeout.current);
        }
        
        // If it's a password change, save immediately (100ms) rather than debouncing 1.5s
        const delay = passwordChangeTrigger > 0 ? 100 : 1500;
        
        autoSaveTimeout.current = setTimeout(() => {
          handleSubmit(undefined, true);
          if (passwordChangeTrigger > 0) {
            setPasswordChangeTrigger(0);
          }
        }, delay);
      }
    return () => {
      if (autoSaveTimeout.current) clearTimeout(autoSaveTimeout.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, lastSavedContent, mode, code, hasServerChanges, passwordChangeTrigger]);

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

  const charCount = content.length;

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-900">
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3 group">
              <Image src="/kloudnotes-logo-trans.png" alt="Kloud Notes Logo" width={32} height={32} className="dark:invert-0 invert group-hover:opacity-80 transition" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white group-hover:text-gray-700 dark:group-hover:text-gray-300 transition">
                Kloud Notes
              </h1>
            </Link>

            <div className="flex items-center gap-2 relative">
              {mode === 'edit' && (
                <button
                  onClick={() => window.location.href = '/'}
                  className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition font-medium"
                >
                  <FilePlus className="w-4 h-4" /> New Note
                </button>
              )}
              {recentNotes.length > 0 && (
                <div className="relative hidden sm:block" ref={recentsRef}>
                  <button
                    onClick={() => setShowRecents(!showRecents)}
                    className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition font-medium"
                  >
                    <Clock className="w-4 h-4" /> Recents
                  </button>
                  {showRecents && (
                    <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
                      <div className="p-3 border-b border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-900 dark:text-white">
                        Recent Notes
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        {recentNotes.map((rn) => (
                          <Link 
                            key={rn.code}
                            href={`/${rn.code}`}
                            className="block p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition border-b border-gray-100 dark:border-gray-700 last:border-0"
                            onClick={() => setShowRecents(false)}
                          >
                            <div className="text-xs font-mono text-blue-600 dark:text-blue-400 mb-1">{rn.code}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-300 truncate">{rn.preview || 'Empty note'}</div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={handlePasswordToggle}
                className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition font-medium"
              >
                {hasPassword || password ? (
                  <><Lock className="w-4 h-4" /> Protected</>
                ) : (
                  <><Unlock className="w-4 h-4" /> Protect</>
                )}
              </button>
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
                {!isEditingUrl ? (
                  <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                    <div className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 font-mono truncate max-w-[200px] sm:max-w-xs">
                      {appUrl}/{mode === 'create' ? customCode : (customCode || code || '')}
                    </div>
                    <div className="flex items-center border-l border-gray-200 dark:border-gray-700">
                      <button
                        type="button"
                        onClick={() => setIsEditingUrl(true)}
                        className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                        title="Edit custom link"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {((mode === 'edit' && code) || (mode === 'create' && customCode)) && (
                        <>
                          <div className="w-px h-4 mx-1 bg-gray-300 dark:bg-gray-600"></div>
                          <button
                            type="button"
                            onClick={handleCopyLink}
                            className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                            title="Copy link"
                          >
                            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap hidden sm:inline">
                      {appUrl}/
                    </span>
                    
                    <div className="relative flex-1 min-w-[120px] sm:flex-none sm:w-48">
                      <input
                        type="text"
                        value={mode === 'create' ? customCode : (customCode || code || '')}
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

                    <button
                      type="button"
                      onClick={handleCancelEditUrl}
                      className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
                      title="Cancel editing"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                )}
                
                {isEditingUrl && (
                  <button
                    type="submit"
                    disabled={isLoading || !content.trim()}
                    className="px-8 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center shadow-lg shadow-blue-500/30 dark:shadow-blue-500/20 whitespace-nowrap min-w-[100px]"
                  >
                    {isLoading ? <Spinner size="sm" /> : mode === 'edit' ? 'Update' : 'Save'}
                  </button>
                )}
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
                <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
                  {mode === 'edit' && note ? (
                    <>Created: {formatDate(note.created_at)} • Updated: {formatDate(note.updated_at)}</>
                  ) : (
                    <span>&nbsp;</span>
                  )}
                  {isAutoSaving && !saveError && (
                    <span className="flex items-center gap-1 text-green-600 dark:text-green-500">
                      <Spinner size="sm" /> Auto-saving...
                    </span>
                  )}
                  {saveError && (
                    <span className="flex items-center gap-1 text-red-600 dark:text-red-500 font-medium">
                      ⚠️ {saveError}
                    </span>
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
