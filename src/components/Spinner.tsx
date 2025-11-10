/**
 * Loading spinner component
 */

export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-3',
    lg: 'h-12 w-12 border-4',
  };

  return (
    <div className="flex items-center justify-center">
      <div
        className={`${sizeClasses[size]} animate-spin rounded-full border-gray-300 dark:border-gray-600 border-t-blue-600 dark:border-t-blue-400`}
        role="status"
        aria-label="Loading"
      >
        <span className="sr-only">Loading...</span>
      </div>
    </div>
  );
}
