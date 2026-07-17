export type ThemeMode = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'databloom-theme';

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'light' || value === 'dark';
}

export function resolveInitialTheme(): ThemeMode {
  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeMode(storedTheme)) return storedTheme;
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;

  const backgroundColor = getComputedStyle(root).getPropertyValue('--bg').trim();
  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (backgroundColor && themeColor) themeColor.content = backgroundColor;
}

export function initializeTheme() {
  const theme = resolveInitialTheme();
  applyTheme(theme);
  return theme;
}

export function persistTheme(theme: ThemeMode) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // The active theme still works for the current session without persistence.
  }
}
