"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    setMounted(true);
    // Load theme from localStorage
    const storedTheme = localStorage.getItem('theme') as Theme | null;
    const initialTheme = storedTheme || 'dark';
    setTheme(initialTheme);
    applyTheme(initialTheme);
  }, []);

  const applyTheme = (newTheme: Theme) => {
    if (typeof window === 'undefined') return;
    
    const htmlElement = document.documentElement;
    const bodyElement = document.body;
    
    if (newTheme === 'dark') {
      htmlElement.classList.add('dark');
      htmlElement.classList.remove('light');
      bodyElement.className = `font-sans antialiased bg-zinc-950 text-zinc-100 transition-colors duration-300`;
    } else {
      htmlElement.classList.remove('dark');
      htmlElement.classList.add('light');
      bodyElement.className = `font-sans antialiased bg-white text-black transition-colors duration-300`;
    }
    localStorage.setItem('theme', newTheme);
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    applyTheme(newTheme);
  };

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    // Return a default context when used outside of ThemeProvider
    return { theme: 'dark' as Theme, toggleTheme: () => {} };
  }
  return context;
}
