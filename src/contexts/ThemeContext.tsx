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
  const [theme, setTheme] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Always check localStorage first - this takes precedence over system preference
    const savedTheme = localStorage.getItem('theme') as Theme | null;

    if (savedTheme === 'dark' || savedTheme === 'light') {
      // User has explicitly set a theme - use it
      setTheme(savedTheme);
      applyTheme(savedTheme);
    } else {
      // No saved preference - check system preference only once
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const defaultTheme = prefersDark ? 'dark' : 'light';
      setTheme(defaultTheme);
      applyTheme(defaultTheme);
    }
  }, []);

  const applyTheme = (newTheme: Theme) => {
    // Remove both classes first to ensure clean state
    document.documentElement.classList.remove('dark', 'light');

    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    }
    // For light mode, we don't add a class - Tailwind uses the absence of 'dark' class
  };

  const toggleTheme = () => {
    if (!mounted) return;
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    // Save to localStorage to persist user's explicit choice
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
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
