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
import { getWidgetDisplayTitle } from '../widgetEngine';

export function StageHeader({
  title,
  viewMode,
  setViewMode,
  acceptedCount,
  pendingCount,
}: {
  title: string;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  acceptedCount: number;
  pendingCount: number;
}) {
  return (
    <div className="stage-header">
      <div>
        <h1>{title}</h1>
        <p>{acceptedCount} widgets actifs · {pendingCount} propositions en attente</p>
      </div>
      <div className="segmented-control">
        {(['board', 'data', 'grid', 'json', 'workflow'] as ViewMode[]).map((mode) => (
          <button key={mode} className={viewMode === mode ? 'active' : ''} type="button" onClick={() => setViewMode(mode)}>
            {mode}
          </button>
        ))}
      </div>
    </div>
  );
}

export function BoardCanvas({
  widgets,
  datasets,
  selectedId,
  onSelect,
  onUpdate,
  onDelete,
  onAccept,
  onReject,
}: {
  widgets: Widget[];
  datasets: Dataset[];
  selectedId: string;
  onSelect: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Widget>) => void;
  onDelete: (id: string) => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}) {
  return (
    <section className="board-canvas">
      {widgets.length === 0 && <p className="empty-state">Importe un dataset, puis demande à l’assistant de proposer des widgets.</p>}
      {widgets.map((widget) => (
        <WidgetCard
          key={widget.id}
          widget={widget}
          dataset={datasets.find((item) => item.id === widget.datasetId)}
          selected={widget.id === selectedId}
          onSelect={onSelect}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onAccept={onAccept}
          onReject={onReject}
        />
      ))}
    </section>
  );
}

function WidgetCard({
  widget,
  dataset,
  selected,
  onSelect,
  onUpdate,
  onDelete,
  onAccept,
  onReject,
}: {
  widget: Widget;
  dataset?: Dataset;
  selected: boolean;
  onSelect: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Widget>) => void;
  onDelete: (id: string) => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const displayTitle = dataset ? getWidgetDisplayTitle(widget, dataset) : widget.title;
  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const origin = { pointerX: event.clientX, pointerY: event.clientY, x: widget.x, y: widget.y };

    const canvas = event.currentTarget.closest('.board-canvas');
    const cellWidth = canvas ? canvas.getBoundingClientRect().width / 12 : 80;
    const move = (moveEvent: globalThis.PointerEvent) => {
      onUpdate(widget.id, {
        x: Math.max(0, Math.round(origin.x + (moveEvent.clientX - origin.pointerX) / cellWidth)),
        y: Math.max(0, Math.round(origin.y + (moveEvent.clientY - origin.pointerY) / 88)),
      });
    };

    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      setIsDragging(false);
    };

    setIsDragging(true);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  };

  const startResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const origin = { pointerX: event.clientX, pointerY: event.clientY, w: widget.w, h: widget.h };
    const canvas = event.currentTarget.closest('.board-canvas');
    const cellWidth = canvas ? canvas.getBoundingClientRect().width / 12 : 80;

    const move = (moveEvent: globalThis.PointerEvent) => {
      onUpdate(widget.id, {
        w: Math.max(2, Math.round(origin.w + (moveEvent.clientX - origin.pointerX) / cellWidth)),
        h: Math.max(2, Math.round(origin.h + (moveEvent.clientY - origin.pointerY) / 88)),
      });
    };

    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  };

  return (
    <article
      className={`widget-card ${widget.type} ${widget.status} ${selected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
      style={{ gridColumn: `${widget.x + 1} / span ${widget.w}`, gridRow: `${widget.y + 1} / span ${widget.h}` }}
      onClick={() => onSelect(widget.id)}
    >
      <div className="widget-toolbar">
        <button className="drag-handle" type="button" title="Déplacer le widget" aria-label={`Déplacer le widget ${displayTitle}`} onPointerDown={startDrag}>
          <GripVertical size={15} />
        </button>
        <span>{widgetLabels[widget.type]}</span>
        <strong>{displayTitle}</strong>
        <div className="widget-toolbar-actions">
          {widget.status === 'pending' && <em>Pending</em>}
          <button
            className="widget-delete-button"
            type="button"
            title={`Supprimer le widget ${displayTitle}`}
            aria-label={`Supprimer le widget ${displayTitle}`}
            onClick={(event) => {
              event.stopPropagation();
              if (window.confirm(`Supprimer le widget « ${displayTitle} » ?`)) onDelete(widget.id);
            }}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      {dataset ? (
        <ChartWidgetBody widget={widget} dataset={dataset} />
      ) : (
        <div className="widget-error" role="alert">
          Dataset introuvable pour ce widget. Sa source n'a pas été remplacée automatiquement.
        </div>
      )}
      {widget.status === 'pending' && (
        <div className="inline-actions">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onAccept(widget.id);
            }}
          >
            <Check size={14} />
            Accept
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onReject(widget.id);
            }}
          >
            <X size={14} />
            Reject
          </button>
        </div>
      )}
      <button className="resize-handle-widget" type="button" title="Redimensionner le widget" aria-label="Redimensionner le widget" onPointerDown={startResize} />
    </article>
  );
}
