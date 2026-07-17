import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { ArrowDown, BarChart3, Check, ChevronDown, Copy, Database, FileJson, GripVertical, LayoutDashboard, LoaderCircle, Mic, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, RefreshCcw, Search, Send, Settings, ShieldAlert, Sparkles, Table2, Trash2, X } from 'lucide-react';
import { widgetLabels, type Conversation } from '../appState';
import type { ApiSourceConfig } from '../apiSource';
import { ChartWidgetBody } from './charts/ChartWidgetBody';
import { ConversationManager } from './ConversationManager';
import { DatasetPanel } from './DatasetPanel';
import { LlmConfigPanel } from './LlmConfigPanel';
import type { LmConfig, LmLogEntry } from '../lmStudio';
import type { Aggregation, ChatMessage, Dataset, ViewMode, Widget, WidgetSort } from '../types';

export function NavigationRail({
  viewMode,
  setViewMode,
  isChatOpen,
  isInspectorOpen,
  onToggleChat,
  onToggleInspector,
}: {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  isChatOpen: boolean;
  isInspectorOpen: boolean;
  onToggleChat: () => void;
  onToggleInspector: () => void;
}) {
  const items: { mode: ViewMode; label: string; icon: typeof LayoutDashboard }[] = [
    { mode: 'board', label: 'Board', icon: LayoutDashboard },
    { mode: 'data', label: 'Data', icon: Database },
    { mode: 'grid', label: 'Grid', icon: Table2 },
    { mode: 'json', label: 'JSON', icon: FileJson },
  ];

  return (
    <nav className="nav-rail" aria-label="Databloom views">
      <button className={isChatOpen ? 'rail-button active' : 'rail-button'} type="button" title="AI panel" onClick={onToggleChat} aria-pressed={isChatOpen}>
        {isChatOpen ? <PanelLeftClose size={23} /> : <PanelLeftOpen size={23} />}
        <span>AI</span>
      </button>
      <button className={isInspectorOpen ? 'rail-button active' : 'rail-button'} type="button" title="Inspector" onClick={onToggleInspector} aria-pressed={isInspectorOpen}>
        {isInspectorOpen ? <PanelRightClose size={23} /> : <PanelRightOpen size={23} />}
        <span>Inspect</span>
      </button>
      <span className="rail-separator" aria-hidden="true" />
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.mode}
            className={viewMode === item.mode ? 'rail-button active' : 'rail-button'}
            type="button"
            title={item.label}
            onClick={() => setViewMode(item.mode)}
          >
            <Icon size={23} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
