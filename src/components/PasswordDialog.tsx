/**
 * Password dialog component for setting/verifying password
 */

'use client';

import { useState, FormEvent } from 'react';
import { Spinner } from './Spinner';

interface PasswordDialogProps {
  onSubmit: (password: string) => Promise<void>;
  error?: string;
  isLoading?: boolean;
  mode?: 'set' | 'verify';
}

export function PasswordDialog({ onSubmit, error, isLoading = false, mode = 'verify' }: PasswordDialogProps) {
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.trim()) {
      await onSubmit(password);
      if (mode === 'set') {
        setPassword('');
      }
    }
  };

  const isVerifyMode = mode === 'verify';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">{isVerifyMode ? '🔒' : '🔐'}</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {isVerifyMode ? 'Password Protected' : 'Set Password'}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            {isVerifyMode
              ? 'This note is password protected. Please enter the password to view it.'
              : 'Enter a password to protect your note. Anyone with the link will need this password to view it.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent outline-none transition"
              placeholder={isVerifyMode ? "Enter password" : "Enter a password"}
              disabled={isLoading}
              autoFocus
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !password.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white py-3 px-4 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center shadow-lg shadow-blue-500/30 dark:shadow-blue-500/20"
          >
            {isLoading ? <Spinner size="sm" /> : isVerifyMode ? 'Unlock Note' : 'Set Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
