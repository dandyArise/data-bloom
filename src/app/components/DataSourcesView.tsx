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

export function DataSourcesView({
  dataset,
  datasets,
  isImporting,
  importError,
  onSelectDataset,
  onRenameDataset,
  onDeleteDataset,
  onImportDataset,
  onOpenGrid,
  onReviewQualityIssue,
  onRemoveDuplicateRows,
  onConnectApi,
  onConnectMonitor,
  onCheckMonitor,
}: {
  dataset: Dataset;
  datasets: Dataset[];
  isImporting: boolean;
  importError: string;
  onSelectDataset: (id: string) => void;
  onRenameDataset: (id: string, name: string) => void;
  onDeleteDataset: (id: string) => void;
  onImportDataset: (file: File) => Promise<void>;
  onOpenGrid: () => void;
  onReviewQualityIssue: (issue: 'duplicates' | 'missing') => void;
  onRemoveDuplicateRows: () => void;
  onConnectApi: (dataset: Dataset, source: Pick<ApiSourceConfig, 'url' | 'syncFrequency'>) => void;
  onConnectMonitor: (dataset: Dataset) => void;
  onCheckMonitor: (datasetId: string) => Promise<void>;
}) {
  return (
    <section className="data-sources-view">
      <div className="data-sources-hero">
        <div>
          <span>Sources de données</span>
          <h2>Importer, choisir et contrôler les datasets</h2>
          <p>Centralise ici le chargement Excel/CSV, la sélection du dataset actif, la qualité data et l’aperçu avant analyse.</p>
        </div>
      </div>
      <div className="data-sources-panel">
        <DatasetPanel
          dataset={dataset}
          datasets={datasets}
          isDatasetOpen
          isImporting={isImporting}
          importError={importError}
          onToggleDataset={() => undefined}
          onSelectDataset={onSelectDataset}
          onRenameDataset={onRenameDataset}
          onDeleteDataset={onDeleteDataset}
            onImportDataset={onImportDataset}
            onOpenGrid={onOpenGrid}
            onReviewQualityIssue={onReviewQualityIssue}
            onRemoveDuplicateRows={onRemoveDuplicateRows}
            onConnectApi={onConnectApi}
            onConnectMonitor={onConnectMonitor}
            onCheckMonitor={onCheckMonitor}
        />
      </div>
    </section>
  );
}
