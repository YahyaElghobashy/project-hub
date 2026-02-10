import { useState, useEffect } from 'react';

// BUG:BZ-084 - FOUC on Theme Toggle
// Switching between light and dark theme causes a single frame of un-styled content
// (white flash in dark mode). The bug occurs because the old theme class is removed
// immediately, but the new theme class is applied after a requestAnimationFrame,
// leaving one paint frame where neither theme class is active.
export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains('dark');
    setIsDark(isDarkMode);
  }, []);

  const handleToggle = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);

    // BUG:BZ-084 - Remove the old class immediately, but apply the new one
    // after a requestAnimationFrame. This creates a single frame where
    // neither 'dark' nor explicit 'light' class is on documentElement,
    // causing an unstyled flash (white background in dark mode transition).
    if (newIsDark) {
      // First remove any existing class, then defer adding 'dark'
      document.documentElement.classList.remove('dark');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document.documentElement.classList.add('dark');
        });
      });
    } else {
      document.documentElement.classList.remove('dark');
    }

    localStorage.setItem('theme', newIsDark ? 'dark' : 'light');

    if (typeof window !== 'undefined') {
      window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
      if (!window.__PERCEPTR_TEST_BUGS__.find(b => b.bugId === 'BZ-084')) {
        window.__PERCEPTR_TEST_BUGS__.push({
          bugId: 'BZ-084',
          timestamp: Date.now(),
          description: 'Theme toggle causes FOUC - class removed before new class applied, creating white flash',
          page: 'Visual/Layout'
        });
      }
    }
  };

  return (
    <div data-bug-id="BZ-084">
      <button
        onClick={handleToggle}
        className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-150 focus:outline-none bg-zinc-200 dark:bg-blue-600"
        role="switch"
        aria-checked={isDark}
        aria-label="Toggle dark mode"
      >
        <span
          className={`
            inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-150
            ${isDark ? 'translate-x-6' : 'translate-x-1'}
          `}
        />
      </button>
    </div>
  );
}
