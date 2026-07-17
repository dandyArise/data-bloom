import { Maximize2, Minimize2, Moon, RefreshCcw, Sun } from 'lucide-react';
import type { ThemeMode } from '../../theme';

type AppTopBarProps = {
  pendingCount: number;
  isPresentationMode: boolean;
  theme: ThemeMode;
  onReset: () => void;
  onToggleTheme: () => void;
  onTogglePresentation: () => void;
};

export function AppTopBar({ pendingCount, isPresentationMode, theme, onReset, onToggleTheme, onTogglePresentation }: AppTopBarProps) {
  const isDark = theme === 'dark';

  return (
    <header className="topbar">
      <div className="brand"><div className="brand-mark">D</div><div><strong>Databloom</strong><span>AI Dashboard Builder</span></div></div>
      <div className="topbar-status"><span className="sync-dot" />Connecté</div>
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
