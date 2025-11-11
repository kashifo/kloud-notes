/**
 * Theme context for dark/light mode
 */

'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    // Initialize from localStorage or system preference during first render
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme') as Theme | null;
      if (savedTheme === 'dark' || savedTheme === 'light') {
        return savedTheme;
      }
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      return prefersDark ? 'dark' : 'light';
    }
    return 'light';
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Apply theme on mount
    applyTheme(theme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Apply theme whenever it changes
    if (mounted) {
      applyTheme(theme);
    }
  }, [theme, mounted]);

  const applyTheme = (newTheme: Theme) => {
    if (typeof window === 'undefined') return;

    // Remove both classes first to ensure clean state
    document.documentElement.classList.remove('dark', 'light');

    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    }
    // For light mode, we don't add a class - Tailwind uses the absence of 'dark' class
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    // Save to localStorage to persist user's explicit choice
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', newTheme);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
