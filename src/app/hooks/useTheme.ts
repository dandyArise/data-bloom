import { useCallback, useEffect, useState } from 'react';
import { applyTheme, persistTheme, resolveInitialTheme, type ThemeMode } from '../theme';

function readAppliedTheme(): ThemeMode {
  const appliedTheme = document.documentElement.dataset.theme;
  return appliedTheme === 'light' || appliedTheme === 'dark' ? appliedTheme : resolveInitialTheme();
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(readAppliedTheme);

  useEffect(() => {
    applyTheme(theme);
    persistTheme(theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, toggleTheme };
}
