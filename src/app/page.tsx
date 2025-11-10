'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/Spinner';
import { ThemeToggle } from '@/components/ThemeToggle';
import { APP_URL } from '@/lib/constants';
import type { CreateNoteResponse, ErrorResponse } from '@/types/note';

export default function Home() {
  const router = useRouter();
  const [content, setContent] = useState('');
  const [password, setPassword] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const appUrl = typeof window !== 'undefined' ? window.location.origin : APP_URL;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!content.trim()) {
      setError('Please enter some content for your note');
      return;
    }

    setIsLoading(true);

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
        // Store the short code in localStorage for editing later
        localStorage.setItem(`note_${data.shortCode}`, 'owner');
        setSuccess(`Note created! Redirecting...`);
        setTimeout(() => {
          router.push(`/${data.shortCode}`);
        }, 1000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const charCount = content.length;
  const maxChars = 10000;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Branding */}
            <div className="flex-shrink-0">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Kloud Notes
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Save & Share your notes on the cloud from anywhere without login
              </p>
            </div>

            {/* Right: Custom Link & Theme Toggle */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2">
                <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                  {appUrl}/
                </span>
                <input
                  type="text"
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                  className="w-32 bg-transparent border-none outline-none text-sm text-gray-900 dark:text-white placeholder-gray-400"
                  placeholder="custom-link"
                  disabled={isLoading}
                />
              </div>
              <ThemeToggle />
            </div>
          </div>

          {/* Mobile Custom Link */}
          <div className="sm:hidden mt-3">
            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
              Enter your custom link
            </label>
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {appUrl}/
              </span>
              <input
                type="text"
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                className="flex-1 bg-transparent border-none outline-none text-sm text-gray-900 dark:text-white placeholder-gray-400"
                placeholder="custom-link"
                disabled={isLoading}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <form onSubmit={handleSubmit} className="h-full flex flex-col gap-4">
          {/* Editor */}
          <div className="flex-1 flex flex-col">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="flex-1 w-full p-4 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent outline-none transition resize-none font-mono text-sm min-h-[400px] lg:min-h-[500px]"
              placeholder="Start typing your note here..."
              disabled={isLoading}
            />
            <div className="flex justify-between items-center mt-2 text-sm">
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition"
              >
                {showPassword ? '🔓 Remove password' : '🔒 Protect with password'}
              </button>
              <span className={`${charCount > maxChars ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                {charCount.toLocaleString()} / {maxChars.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Password Protection */}
          {showPassword && (
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent outline-none transition"
                placeholder="Enter password to protect your note"
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Viewers will need this password to read your note
              </p>
            </div>
          )}

          {/* Error/Success Messages */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || !content.trim() || charCount > maxChars}
            className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white py-3 px-6 rounded-lg font-medium text-base disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center shadow-lg shadow-blue-500/30 dark:shadow-blue-500/20"
          >
            {isLoading ? <Spinner size="sm" /> : 'Create Note'}
          </button>
        </form>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 py-4 text-center">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Built with Next.js, TypeScript, and Supabase • Open Source
        </p>
      </footer>
    </div>
  );
}
