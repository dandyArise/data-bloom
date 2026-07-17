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

export function CodePanel({ title, value }: { title: string; value: string }) {
  return (
    <section className="code-panel">
      <div>
        <strong>{title}</strong>
        <CopyBlock label="Copy" value={value} />
      </div>
      <pre>{value}</pre>
    </section>
  );
}

function CopyBlock({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <button className="copy-button" type="button" onClick={copy}>
      <Copy size={14} />
      {copied ? 'Copied' : label}
    </button>
  );
}
