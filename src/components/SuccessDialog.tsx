/**
 * Success dialog after note creation/update
 */

'use client';

import { useState } from 'react';

interface SuccessDialogProps {
  url: string;
  onClose: () => void;
}

export function SuccessDialog({ url, onClose }: SuccessDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-gray-200 dark:border-gray-700">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">✓</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Note Saved!
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Your note has been saved successfully
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Share this link
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={url}
                readOnly
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono"
                onClick={(e) => e.currentTarget.select()}
              />
              <button
                onClick={handleCopy}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg font-medium transition"
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
