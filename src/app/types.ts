export type WidgetType =
  | 'kpi'
  | 'comparison'
  | 'kpi-group'
  | 'pie'
  | 'bar'
  | 'line'
  | 'heatmap'
  | 'table'
  | 'text'
  | 'note'
  | 'service-status'
  | 'threshold-line'
  | 'radial-gauge'
  | 'availability-grid';
export type WidgetStatus = 'accepted' | 'pending' | 'rejected';
export type Aggregation = 'sum' | 'avg' | 'count' | 'rate';
export type ViewMode = 'board' | 'data' | 'grid' | 'json' | 'workflow';
export type WidgetSort = 'label_asc' | 'label_desc' | 'value_asc' | 'value_desc';
export type DatasetId = string;

export type WidgetThresholds = {
  warning: number;
  critical: number;
  min?: number;
  max?: number;
  direction?: 'higher-is-worse' | 'lower-is-worse';
};

export type WidgetConfig = {
  xField?: string;
  yField?: string;
  groupBy?: string;
  columns?: string[];
  limit?: number;
  sort?: WidgetSort;
  thresholds?: WidgetThresholds;
  unit?: string;
  filterValue?: string;
  legendPosition?: 'right' | 'bottom' | 'none';
  legendDetail?: 'label' | 'value' | 'percentage' | 'value_percentage';
  sliceLabel?: 'none' | 'label' | 'value' | 'percentage' | 'label_percentage';
};

export type Widget = {
  id: string;
  changesetId?: string;
  requestId?: string;
  datasetId?: DatasetId;
  title: string;
  type: WidgetType;
  status: WidgetStatus;
  x: number;
  y: number;
  w: number;
  h: number;
  field: string;
  aggregation: Aggregation;
  config?: WidgetConfig;
  value?: string;
  trend?: string;
  description?: string;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  datasetId?: DatasetId;
  requestId?: string;
  createdAt?: string;
};

export type DatasetField = {
  name: string;
  type: 'string' | 'number' | 'date';
};

export type Dataset = {
  /** Primary key: a UUID, referenced by widgets, messages and conversations. */
  id: DatasetId;
  name: string;
  fields: DatasetField[];
  rows: Record<string, string | number>[];
  source?: DatasetSource;
};

export type SyncFrequency = 'manual' | '15m' | '1h' | '24h';

export type ApiDatasetSource = {
  type: 'api';
  url: string;
  syncFrequency: SyncFrequency;
  lastSyncedAt: string;
};

export type MonitorDatasetSource = {
  type: 'monitor';
  url: string;
  probeType: 'http' | 'dns' | 'ping';
  syncFrequency: SyncFrequency;
  lastCheckedAt: string;
  lastStatus: 'up' | 'degraded' | 'down';
  lastLatencyMs?: number;
  lastMessage?: string;
};

export type DatasetSource = ApiDatasetSource | MonitorDatasetSource;
