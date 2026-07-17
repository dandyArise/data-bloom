import type { Aggregation as BloomAggregation, WidgetConfig as BloomConfig, WidgetData as BloomData, WidgetSize } from '@bloom/index';
import { getCategoricalColor, getThresholdSeverity, type ServiceStatus, type ThresholdSeverity } from './chartColors';
import { isAggregatableMeasureField } from './dataProfiling';
import {
  asMonitorNumber,
  formatMonitorValue,
  formatRelativeCheck,
  getLatestMonitorRow,
  getMonitorHostField,
  getMonitorRows,
  getMonitorStatusField,
  getMonitorTimeField,
  getMonitorValueField,
  latencyThresholdDefaults,
  normalizeServiceStatus,
  percentageThresholdDefaults,
  resolveWidgetThresholds,
} from './monitoringWidgetEngine';
import type { Dataset, Widget, WidgetType } from './types';
import {
  aggregateField,
  buildGroupedSeries,
  buildHeatmapMatrix,
  buildKpiTrend,
  buildLineSeries,
  getVisibleTableFields,
  getWidgetConfig,
  getWidgetDisplayTitle,
} from './widgetEngine';

export type PreparedBloomWidget = {
  type: string;
  data: BloomData;
  config: BloomConfig;
};

type Adapter = (widget: Widget, dataset: Dataset) => PreparedBloomWidget;

const numberField = (name = 'value') => ({ name, type: 'number' as const });
const stringField = (name: string) => ({ name, type: 'string' as const });
const statusColors = new Map<string, string>([
  ['up', 'var(--pos)'], ['healthy', 'var(--pos)'],
  ['degraded', 'var(--warn)'], ['warning', 'var(--warn)'],
  ['down', 'var(--neg)'], ['critical', 'var(--neg)'],
  ['unknown', 'var(--muted)'],
]);

const mapAggregation = (aggregation: Widget['aggregation']): BloomAggregation =>
  aggregation === 'rate' ? 'avg' : aggregation;

const mapSize = (widget: Widget): WidgetSize => {
  const area = widget.w * widget.h;
  if (area <= 9) return 'xs';
  if (area <= 16) return 'sm';
  if (area <= 32) return 'md';
  return 'lg';
};

const mapSort = (sort: NonNullable<Widget['config']>['sort']): BloomConfig['sort'] | undefined => {
  if (!sort) return undefined;
  const [by, direction] = sort.split('_') as ['label' | 'value', 'asc' | 'desc'];
  return { by, direction };
};

const commonConfig = (widget: Widget, dataset: Dataset, type = widget.type): BloomConfig => {
  const source = getWidgetConfig(widget, dataset);
  return {
    type,
    title: getWidgetDisplayTitle(widget, dataset),
    dimension: source.groupBy ?? source.xField,
    measure: source.yField ?? widget.field,
    aggregation: mapAggregation(widget.aggregation),
    limit: source.limit,
    sort: mapSort(source.sort),
    size: mapSize(widget),
    colorScheme: (label, index) => getCategoricalColor(label, index, source.groupBy ?? source.xField, source.yField ?? widget.field),
    legendPosition: source.legendPosition,
    legendDetail: source.legendDetail,
    sliceLabel: source.sliceLabel,
  };
};

const prepareSeries = (widget: Widget, dataset: Dataset, type = widget.type): PreparedBloomWidget => {
  const rows = buildGroupedSeries(dataset, widget);
  return {
    type,
    data: { rows, fields: [stringField('label'), numberField()] },
    config: { ...commonConfig(widget, dataset, type), dimension: 'label', measure: 'value' },
  };
};

const prepareKpi: Adapter = (widget, dataset) => {
  const source = getWidgetConfig(widget, dataset);
  const measure = source.yField ?? widget.field;
  const trend = buildKpiTrend(dataset, widget);
  return {
    type: 'kpi',
    data: {
      rows: [{ value: aggregateField(dataset, measure, widget.aggregation), label: `${widget.aggregation}(${measure})`, trendText: trend.text, trendDirection: trend.direction }],
      fields: [numberField(), stringField('label'), stringField('trendText'), stringField('trendDirection')],
    },
    config: commonConfig(widget, dataset),
  };
};

const prepareComparison: Adapter = (widget, dataset) => {
  const trend = buildKpiTrend(dataset, widget);
  const aggregationLabel = `${widget.aggregation}(${getWidgetConfig(widget, dataset).yField ?? widget.field})`;
  const rows = trend.current === undefined || trend.previous === undefined ? [] : [
    { label: 'Actuel', value: trend.current, trendText: trend.text, trendDirection: trend.direction, aggregationLabel },
    { label: 'Précédent', value: trend.previous },
  ];
  return { type: 'comparison', data: { rows, fields: [stringField('label'), numberField()] }, config: commonConfig(widget, dataset) };
};

const prepareKpiGroup: Adapter = (widget, dataset) => {
  const validMeasures = dataset.fields.filter(isAggregatableMeasureField);
  const configured = widget.config?.columns?.filter((name) => validMeasures.some((field) => field.name === name));
  const measures = (configured?.length ? configured : validMeasures.map((field) => field.name)).slice(0, 4);
  return {
    type: 'kpi-group',
    data: {
      rows: measures.map((measure) => ({ label: measure, value: aggregateField(dataset, measure, widget.aggregation), aggregationLabel: widget.aggregation })),
      fields: [stringField('label'), numberField(), stringField('aggregationLabel')],
    },
    config: commonConfig(widget, dataset),
  };
};

const isSequentialLine = (widget: Widget, dataset: Dataset) => {
  const fieldName = getWidgetConfig(widget, dataset).xField;
  const field = dataset.fields.find((candidate) => candidate.name === fieldName);
  return field?.type === 'date' || /date|time|timestamp|day|jour|week|semaine|month|mois|year|annee|année|quarter|trimestre/i.test(fieldName ?? '');
};

const prepareLine: Adapter = (widget, dataset) => {
  if (!isSequentialLine(widget, dataset)) return prepareSeries(widget, dataset, 'bar');
  return {
    type: 'line',
    data: { rows: buildLineSeries(dataset, widget), fields: [stringField('label'), numberField()] },
    config: { ...commonConfig(widget, dataset), dimension: 'label', measure: 'value' },
  };
};

const prepareHeatmap: Adapter = (widget, dataset) => {
  const matrix = buildHeatmapMatrix(dataset, widget);
  const rows = matrix?.cells.map((cell) => ({ row: cell.yLabel, column: cell.xLabel, value: cell.value })) ?? [];
  return {
    type: 'heatmap',
    data: { rows, fields: [stringField('row'), stringField('column'), numberField()] },
    config: { ...commonConfig(widget, dataset), dimension: matrix ? `${matrix.yField} × ${matrix.xField}` : undefined, measure: matrix?.valueField },
  };
};

const prepareTable: Adapter = (widget, dataset) => {
  const visible = getVisibleTableFields(dataset, widget);
  return {
    type: 'table',
    data: { rows: dataset.rows, fields: dataset.fields.filter((field) => visible.includes(field.name)) },
    config: commonConfig(widget, dataset),
  };
};

const prepareText: Adapter = (widget, dataset) => ({
  type: widget.type,
  data: { rows: [{ text: widget.description ?? widget.value ?? 'Ajoutez un contenu à ce widget.' }], fields: [stringField('text')] },
  config: commonConfig(widget, dataset),
});

const statusColorScheme = (label: string) => statusColors.get(label) ?? 'var(--muted)';
const severityToStatus = (severity: ThresholdSeverity): ServiceStatus => severity === 'critical' ? 'down' : severity === 'warning' ? 'degraded' : 'up';

const prepareServiceStatus: Adapter = (widget, dataset) => {
  const latest = getLatestMonitorRow(dataset, widget);
  if (!latest) return { type: 'service-status', data: { rows: [], fields: [] }, config: { ...commonConfig(widget, dataset), colorScheme: statusColorScheme } };
  const hostField = getMonitorHostField(dataset, widget);
  const statusField = getMonitorStatusField(dataset, widget);
  const timeField = getMonitorTimeField(dataset, widget);
  const valueField = getMonitorValueField(dataset, widget);
  const source = dataset.source?.type === 'monitor' ? dataset.source : undefined;
  const filtered = Boolean(widget.config?.filterValue);
  const status = normalizeServiceStatus((filtered && statusField ? latest[statusField] : undefined) ?? source?.lastStatus ?? (statusField ? latest[statusField] : undefined));
  const host = String((hostField ? latest[hostField] : undefined) ?? source?.url ?? dataset.name);
  const latency = asMonitorNumber((filtered && valueField ? latest[valueField] : undefined) ?? source?.lastLatencyMs ?? (valueField ? latest[valueField] : undefined));
  const checkedAt = (filtered && timeField ? latest[timeField] : undefined) ?? source?.lastCheckedAt ?? (timeField ? latest[timeField] : undefined);
  const unit = widget.config?.unit ?? 'ms';
  const summary = `${latency === null ? 'Latence inconnue' : formatMonitorValue(latency, unit)} · dernier contrôle ${formatRelativeCheck(checkedAt)}`;
  return {
    type: 'service-status',
    data: { rows: [{ host, status, summary, message: source?.lastMessage ?? '' }], fields: [stringField('host'), stringField('status'), stringField('summary')] },
    config: { ...commonConfig(widget, dataset), colorScheme: statusColorScheme },
  };
};

const severityLabels = { healthy: 'Dans la normale', warning: 'Au-dessus du seuil', critical: 'Seuil critique dépassé' } as const;

const prepareGauge: Adapter = (widget, dataset) => {
  const latest = getLatestMonitorRow(dataset, widget);
  const valueField = getMonitorValueField(dataset, widget);
  const value = latest && valueField ? asMonitorNumber(latest[valueField]) : null;
  if (value === null || !valueField) return { type: 'radial-gauge', data: { rows: [], fields: [] }, config: { ...commonConfig(widget, dataset), colorScheme: statusColorScheme } };
  const thresholds = resolveWidgetThresholds(widget, percentageThresholdDefaults);
  const severity = getThresholdSeverity(value, thresholds);
  const unit = widget.config?.unit ?? (/loss|perte|rate|taux/i.test(valueField) ? '%' : '');
  return {
    type: 'radial-gauge',
    data: {
      rows: [{ value, minimum: thresholds.min, maximum: thresholds.max, severity, unit, severityLabel: severityLabels[severity], thresholdLabel: `${severityLabels[severity]} (${formatMonitorValue(thresholds.warning, unit)})` }],
      fields: [numberField(), numberField('minimum'), numberField('maximum'), stringField('severity')],
    },
    config: { ...commonConfig(widget, dataset), colorScheme: statusColorScheme },
  };
};

const formatTimeLabel = (value: unknown) => {
  if (typeof value !== 'string') return String(value);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const prepareThresholdLine: Adapter = (widget, dataset) => {
  const valueField = getMonitorValueField(dataset, widget);
  const timeField = getMonitorTimeField(dataset, widget);
  const thresholds = resolveWidgetThresholds(widget, latencyThresholdDefaults);
  const limit = Math.min(Math.max(widget.config?.limit ?? 24, 2), 100);
  const rows: Record<string, unknown>[] = [];
  if (valueField) {
    for (const sourceRow of getMonitorRows(dataset, widget).slice(-limit)) {
      const value = asMonitorNumber(sourceRow[valueField]);
      if (value === null) continue;
      rows.push({
        label: formatTimeLabel(timeField ? sourceRow[timeField] : rows.length + 1), value,
        minimum: thresholds.min, maximum: thresholds.max, warning: thresholds.warning, critical: thresholds.critical,
        direction: thresholds.direction, unit: widget.config?.unit ?? (/lat/i.test(valueField) ? 'ms' : ''),
        severity: getThresholdSeverity(value, thresholds),
      });
    }
  }
  return {
    type: 'threshold-line',
    data: { rows, fields: [stringField('label'), numberField(), numberField('warning'), numberField('critical')] },
    config: { ...commonConfig(widget, dataset), colorScheme: statusColorScheme },
  };
};

const prepareAvailability: Adapter = (widget, dataset) => {
  const hostField = getMonitorHostField(dataset, widget);
  const statusField = getMonitorStatusField(dataset, widget);
  const timeField = getMonitorTimeField(dataset, widget);
  const valueField = getMonitorValueField(dataset, widget);
  const thresholds = resolveWidgetThresholds(widget, latencyThresholdDefaults);
  const fallbackHost = dataset.source?.type === 'monitor' ? dataset.source.url : dataset.name;
  const occurrences = new Map<string, number>();
  const rows: Record<string, unknown>[] = [];
  for (const sourceRow of getMonitorRows(dataset, widget)) {
    const host = String((hostField ? sourceRow[hostField] : undefined) ?? fallbackHost);
    const value = valueField ? asMonitorNumber(sourceRow[valueField]) : null;
    const normalized = normalizeServiceStatus(statusField ? sourceRow[statusField] : undefined);
    const status = normalized === 'unknown' && value !== null ? severityToStatus(getThresholdSeverity(value, thresholds)) : normalized;
    const rawTime = timeField ? sourceRow[timeField] : '';
    const label = formatTimeLabel(rawTime);
    const fingerprint = `${host}-${String(rawTime)}-${status}-${String(value ?? '')}`;
    const occurrence = (occurrences.get(fingerprint) ?? 0) + 1;
    occurrences.set(fingerprint, occurrence);
    rows.push({ id: `${fingerprint}-${occurrence}`, host, label, status });
  }
  return {
    type: 'availability-grid',
    data: { rows, fields: [stringField('id'), stringField('host'), stringField('label'), stringField('status')] },
    config: { ...commonConfig(widget, dataset), limit: widget.config?.limit ?? 12, colorScheme: statusColorScheme },
  };
};

const adapters = new Map<WidgetType, Adapter>([
  ['kpi', prepareKpi],
  ['comparison', prepareComparison],
  ['kpi-group', prepareKpiGroup],
  ['bar', (widget, dataset) => prepareSeries(widget, dataset)],
  ['line', prepareLine],
  ['pie', (widget, dataset) => prepareSeries(widget, dataset)],
  ['heatmap', prepareHeatmap],
  ['table', prepareTable],
  ['text', prepareText],
  ['note', prepareText],
  ['service-status', prepareServiceStatus],
  ['threshold-line', prepareThresholdLine],
  ['radial-gauge', prepareGauge],
  ['availability-grid', prepareAvailability],
]);

export function prepareBloomWidget(widget: Widget, dataset: Dataset): PreparedBloomWidget | null {
  return adapters.get(widget.type)?.(widget, dataset) ?? null;
}
