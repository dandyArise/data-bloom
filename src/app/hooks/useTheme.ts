import { useCallback, useEffect, useState } from 'react';
import { applyPalette, applyTheme, persistPalette, persistTheme, resolveInitialPalette, resolveInitialTheme, type ColorPalette, type ThemeMode } from '../theme';

function readAppliedTheme(): ThemeMode {
  const appliedTheme = document.documentElement.dataset.theme;
  return appliedTheme === 'light' || appliedTheme === 'dark' ? appliedTheme : resolveInitialTheme();
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(readAppliedTheme);
  const [palette, setPalette] = useState<ColorPalette>(resolveInitialPalette);

  useEffect(() => {
    applyPalette(palette);
    applyTheme(theme);
    persistTheme(theme);
    persistPalette(palette);
  }, [palette, theme]);

  const toggleTheme = useCallback(() => {
    setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, toggleTheme, palette, setPalette };
}
