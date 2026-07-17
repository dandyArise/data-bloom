import { Maximize2, Minimize2, Moon, Palette, RefreshCcw, Sun } from 'lucide-react';
import { colorPalettes, type ColorPalette, type ThemeMode } from '../../theme';

type AppTopBarProps = {
  pendingCount: number;
  isPresentationMode: boolean;
  theme: ThemeMode;
  palette: ColorPalette;
  onReset: () => void;
  onToggleTheme: () => void;
  onPaletteChange: (palette: ColorPalette) => void;
  onTogglePresentation: () => void;
};

export function AppTopBar({ pendingCount, isPresentationMode, theme, palette, onReset, onToggleTheme, onPaletteChange, onTogglePresentation }: AppTopBarProps) {
  const isDark = theme === 'dark';

  return (
    <header className="topbar">
      <div className="brand"><div className="brand-mark">D</div><div><strong>Databloom</strong><span>AI Dashboard Builder</span></div></div>
       <div className="topbar-status"><span className="sync-dot" />Connecté</div>
       <label className="topbar-palette">
         <Palette size={18} aria-hidden="true" />
         <span>Palette</span>
         <select value={palette} onChange={(event) => onPaletteChange(event.target.value as ColorPalette)} aria-label="Palette de couleurs">
           {colorPalettes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
         </select>
       </label>
      <button
        className="ghost-button theme-toggle"
        type="button"
        onClick={onToggleTheme}
        aria-label={isDark ? 'Activer le thème clair' : 'Activer le thème sombre'}
        aria-pressed={isDark}
        title={isDark ? 'Passer au thème clair' : 'Passer au thème sombre'}
      >
        {isDark ? <Sun size={20} /> : <Moon size={20} />}
        <span>{isDark ? 'Clair' : 'Sombre'}</span>
      </button>
      <button className="ghost-button" type="button" onClick={onReset}><RefreshCcw size={20} />Réinitialiser</button>
      <button className={isPresentationMode ? 'primary-button active-mode' : 'ghost-button'} type="button" onClick={onTogglePresentation} aria-pressed={isPresentationMode}>{isPresentationMode ? <Minimize2 size={20} /> : <Maximize2 size={20} />}{isPresentationMode ? 'Quitter' : 'Présenter'}</button>
      <div className="pending-pill">{pendingCount} en attente</div>
    </header>
  );
}
