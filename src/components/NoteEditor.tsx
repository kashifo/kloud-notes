/**
 * Note editor component for creating new notes
 */

'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from './Spinner';
import type { CreateNoteResponse, ErrorResponse } from '@/types/note';

export function NoteEditor() {
  const router = useRouter();
  const [content, setContent] = useState('');
  const [password, setPassword] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
    <div className="w-full max-w-3xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
            Your Note
          </label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-64 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition resize-none font-mono text-sm"
            placeholder="Start typing your note here..."
            disabled={isLoading}
          />
          <div className="flex justify-between items-center mt-2">
            <span className={`text-sm ${charCount > maxChars ? 'text-red-600' : 'text-gray-500'}`}>
              {charCount.toLocaleString()} / {maxChars.toLocaleString()} characters
            </span>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              {showAdvanced ? 'Hide' : 'Show'} Advanced Options
            </button>
          </div>
        </div>

        {showAdvanced && (
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password Protection (Optional)
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                placeholder="Enter password to protect your note"
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500 mt-1">
                If set, viewers will need this password to read your note
              </p>
            </div>

            <div>
              <label htmlFor="customCode" className="block text-sm font-medium text-gray-700 mb-2">
                Custom Short Code (Optional)
              </label>
              <input
                type="text"
                id="customCode"
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition font-mono"
                placeholder="my-custom-code"
                disabled={isLoading}
                pattern="[a-zA-Z0-9_-]+"
              />
              <p className="text-xs text-gray-500 mt-1">
                Letters, numbers, hyphens, and underscores only (6-50 characters)
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {success && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-600">{success}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || !content.trim() || charCount > maxChars}
          className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium text-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center"
        >
          {isLoading ? <Spinner size="sm" /> : 'Create Note'}
        </button>
      </form>
    </div>
  );
}
