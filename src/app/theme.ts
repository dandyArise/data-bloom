export type ThemeMode = 'light' | 'dark';
export type ColorPalette = 'balanced' | 'indigo' | 'forest';

export const THEME_STORAGE_KEY = 'databloom-theme';
export const PALETTE_STORAGE_KEY = 'databloom-palette';

export const colorPalettes: ReadonlyArray<{ value: ColorPalette; label: string }> = [
  { value: 'balanced', label: 'Équilibrée' },
  { value: 'indigo', label: 'Indigo' },
  { value: 'forest', label: 'Forêt' },
];

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'light' || value === 'dark';
}

function isColorPalette(value: string | null): value is ColorPalette {
  return value === 'balanced' || value === 'indigo' || value === 'forest';
}

export function resolveInitialPalette(): ColorPalette {
  try {
    const storedPalette = window.localStorage.getItem(PALETTE_STORAGE_KEY);
    if (isColorPalette(storedPalette)) return storedPalette;
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
  return 'balanced';
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

export function applyPalette(palette: ColorPalette) {
  document.documentElement.dataset.palette = palette;
}

export function initializeTheme() {
  const theme = resolveInitialTheme();
  applyPalette(resolveInitialPalette());
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

export function persistPalette(palette: ColorPalette) {
  try {
    window.localStorage.setItem(PALETTE_STORAGE_KEY, palette);
  } catch {
    // The active palette still works for the current session without persistence.
  }
}
