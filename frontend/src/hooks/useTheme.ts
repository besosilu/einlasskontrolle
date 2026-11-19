import { useCallback, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
const STORAGE_KEY = 'theme';

function readTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

// Hell ist der Standard; die Wahl wird im Browser gemerkt (index.html setzt sie schon vor dem ersten Rendern)
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Speichern nicht möglich (z.B. privates Fenster) - gilt dann nur für diese Sitzung
    }
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  return { theme, toggle };
}
