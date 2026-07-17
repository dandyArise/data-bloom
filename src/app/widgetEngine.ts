import type { Aggregation, Dataset, DatasetField, Widget, WidgetConfig } from './types';
import { isAggregatableMeasureField } from './dataProfiling';

export type SeriesPoint = {
  label: string;
  value: number;
};

export type HeatmapCell = {
  xLabel: string;
  yLabel: string;
  value: number | null;
};

export type HeatmapMatrix = {
  xField: string;
  yField: string;
  valueField?: string;
  xLabels: string[];
  yLabels: string[];
  cells: HeatmapCell[];
  minimum: number;
  maximum: number;
  populatedCellCount: number;
};

export type KpiTrend = {
  text: string;
  direction: 'up' | 'down' | 'flat' | 'unavailable';
  current?: number;
  previous?: number;
};

const emptyLabels = new Set(['', 'null', 'undefined']);
const dimensionTitleLabels = new Map([
  ['country', 'pays'],
  ['product', 'produit'],
  ['month name', 'mois'],
  ['discount band', 'niveau de remise'],
]);
const measureTitleAliases = [
  { title: /\b(ventes?|sales?|revenus?|revenue|chiffre d affaires)\b/, field: /sales?|ventes?|revenus?|revenue|gross sales|chiffre d affaires/ },
  { title: /\b(profit|profits|benefice|benefices|marge|marges)\b/, field: /profit|benefice|marge|margin/ },
  { title: /\b(couts?|costs?|cogs)\b/, field: /cogs|cost|cout/ },
  { title: /\b(unites? vendues?|units? sold)\b/, field: /units? sold|unites? vendues?/ },
];

const cleanLabel = (value: unknown) => {
  const label = String(value ?? '').trim();
  return emptyLabels.has(label.toLowerCase()) ? '—' : label;
};

const asNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized = trimmed
    .replace(/[€$£%]/g, '')
    .replace(/\s/g, '')
    .replace(/,(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
};

const findField = (dataset: Dataset, name?: string) => dataset.fields.find((field) => field.name === name);

const firstFieldOfType = (dataset: Dataset, type: DatasetField['type']) => dataset.fields.find((field) => field.type === type)?.name;

const findPreferredMeasure = (dataset: Dataset, title: string) => {
  const measures = dataset.fields.filter(isAggregatableMeasureField);
  const normalizedTitle = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const directMatch = measures.find((field) => normalizedTitle.includes(field.name.toLowerCase()));
  if (directMatch) return directMatch.name;
  const alias = measureTitleAliases.find((candidate) => candidate.title.test(normalizedTitle));
  return alias ? measures.find((field) => alias.field.test(field.name.toLowerCase()))?.name ?? measures[0]?.name : measures[0]?.name;
};

export const getWidgetConfig = (widget: Widget, dataset: Dataset): Required<Pick<WidgetConfig, 'limit' | 'sort'>> & WidgetConfig => {
  const numericFallback = findPreferredMeasure(dataset, widget.title);
  const categoricalFallback = dataset.fields.find((field) => field.type !== 'number')?.name ?? dataset.fields[0]?.name;
  const config = widget.config ?? {};
  const configuredMeasure = findField(dataset, config.yField);
  const widgetMeasure = findField(dataset, widget.field);
  const yField = widget.aggregation === 'count'
    ? configuredMeasure?.name
    : configuredMeasure && isAggregatableMeasureField(configuredMeasure)
      ? configuredMeasure.name
      : widgetMeasure && isAggregatableMeasureField(widgetMeasure)
        ? widgetMeasure.name
        : numericFallback;
  const xField = findField(dataset, config.xField)?.name ?? (widget.type === 'line' ? firstFieldOfType(dataset, 'date') ?? categoricalFallback : categoricalFallback ?? widget.field);
  const groupBy = findField(dataset, config.groupBy)?.name ?? xField;

  return {
    ...config,
    xField,
    yField,
    groupBy,
    limit: Math.min(Math.max(Number(config.limit ?? 8), 1), 50),
    sort: config.sort ?? 'value_desc',
  };
};

export const getWidgetDisplayTitle = (widget: Widget, dataset: Dataset) => {
  if (widget.type !== 'bar' && widget.type !== 'pie') return widget.title;
  const dimension = getWidgetConfig(widget, dataset).groupBy;
  if (!dimension) return widget.title;
  const dimensionLabel = dimensionTitleLabels.get(dimension.toLowerCase()) ?? dimension;
  return widget.title.replace(/\b(par|by)\s+.+$/i, (_match, separator: string) => `${separator} ${dimensionLabel}`);
};

export const aggregateValues = (values: number[], aggregation: Aggregation, rowCount: number) => {
  if (aggregation === 'count') return rowCount;
  if (values.length === 0) return 0;
  const total = values.reduce((sum, value) => sum + value, 0);
  if (aggregation === 'avg') return total / values.length;
  if (aggregation === 'rate') return rowCount === 0 ? 0 : total / rowCount;
  return total;
};

export const aggregateField = (dataset: Dataset, field: string, aggregation: Aggregation) => {
  const rowsWithValue = dataset.rows.filter((row) => cleanLabel(row[field]) !== '—');
  const values = rowsWithValue.map((row) => asNumber(row[field])).filter((value): value is number => value !== null);
  return aggregateValues(values, aggregation, rowsWithValue.length);
};

const sortSeries = (points: SeriesPoint[], sort: WidgetConfig['sort']) => {
  const sorted = [...points];
  if (sort === 'label_asc') sorted.sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  if (sort === 'label_desc') sorted.sort((a, b) => b.label.localeCompare(a.label, 'fr'));
  if (sort === 'value_asc') sorted.sort((a, b) => a.value - b.value);
  if (sort === 'value_desc') sorted.sort((a, b) => b.value - a.value);
  return sorted;
};

export const buildGroupedSeries = (dataset: Dataset, widget: Widget): SeriesPoint[] => {
  const config = getWidgetConfig(widget, dataset);
  const groups = new Map<string, { values: number[]; rowCount: number }>();
  const groupField = config.groupBy ?? widget.field;
  const valueField = config.yField ?? widget.field;

  dataset.rows.forEach((row) => {
    const label = cleanLabel(row[groupField]);
    const group = groups.get(label) ?? { values: [], rowCount: 0 };
    const numericValue = asNumber(row[valueField]);
    group.rowCount += 1;
    if (numericValue !== null) group.values.push(numericValue);
    groups.set(label, group);
  });

  return sortSeries(
    [...groups.entries()].map(([label, group]) => ({
      label,
      value: aggregateValues(group.values, widget.aggregation, group.rowCount),
    })),
    config.sort,
  ).slice(0, config.limit);
};

export const buildLineSeries = (dataset: Dataset, widget: Widget): SeriesPoint[] => {
  const config = getWidgetConfig(widget, dataset);
  const points = buildGroupedSeries(dataset, {
    ...widget,
    config: {
      ...widget.config,
      groupBy: config.xField,
      yField: config.yField,
      sort: config.sort === 'value_asc' || config.sort === 'value_desc' ? 'label_asc' : config.sort,
    },
  });

  return points;
};

const heatmapDimensionPattern = /date|time|timestamp|day|jour|hour|heure|week|semaine|month|mois|year|annee|année|sensor|capteur|device|host|service|category|categorie|catégorie/i;

export const buildHeatmapMatrix = (dataset: Dataset, widget: Widget): HeatmapMatrix | null => {
  const config = getWidgetConfig(widget, dataset);
  const valueField = widget.aggregation === 'count' ? undefined : config.yField;
  const preferredAxes: DatasetField[] = [];
  const fallbackAxes: DatasetField[] = [];

  for (const field of dataset.fields) {
    if (field.name === valueField) continue;
    if (field.type !== 'number' || heatmapDimensionPattern.test(field.name)) preferredAxes.push(field);
    else fallbackAxes.push(field);
  }

  const axisCandidates = [...preferredAxes, ...fallbackAxes];
  const configuredXField = dataset.fields.find((field) => field.name === widget.config?.xField)?.name;
  const configuredYField = dataset.fields.find((field) => field.name === widget.config?.groupBy)?.name;
  const xField = configuredXField ?? axisCandidates[0]?.name;
  const yField = configuredYField && configuredYField !== xField
    ? configuredYField
    : axisCandidates.find((field) => field.name !== xField)?.name;

  if (!xField || !yField || xField === yField) return null;

  const axisLimit = Math.min(config.limit, 12);
  const xLabels: string[] = [];
  const yLabels: string[] = [];
  const seenX = new Set<string>();
  const seenY = new Set<string>();
  const buckets = new Map<string, { xLabel: string; yLabel: string; values: number[]; rowCount: number }>();

  for (const row of dataset.rows) {
    const xLabel = cleanLabel(row[xField]);
    const yLabel = cleanLabel(row[yField]);
    if (xLabel === '—' || yLabel === '—') continue;

    if (!seenX.has(xLabel)) {
      if (xLabels.length >= axisLimit) continue;
      seenX.add(xLabel);
      xLabels.push(xLabel);
    }
    if (!seenY.has(yLabel)) {
      if (yLabels.length >= axisLimit) continue;
      seenY.add(yLabel);
      yLabels.push(yLabel);
    }

    const key = JSON.stringify([yLabel, xLabel]);
    const bucket = buckets.get(key) ?? { xLabel, yLabel, values: [], rowCount: 0 };
    bucket.rowCount += 1;
    if (valueField) {
      const numericValue = asNumber(row[valueField]);
      if (numericValue !== null) bucket.values.push(numericValue);
    }
    buckets.set(key, bucket);
  }

  const cells: HeatmapCell[] = [];
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  let populatedCellCount = 0;

  for (const yLabel of yLabels) {
    for (const xLabel of xLabels) {
      const bucket = buckets.get(JSON.stringify([yLabel, xLabel]));
      const hasValue = Boolean(bucket) && (widget.aggregation === 'count' || bucket!.values.length > 0);
      const value = hasValue
        ? aggregateValues(bucket!.values, widget.aggregation, bucket!.rowCount)
        : null;
      cells.push({ xLabel, yLabel, value });
      if (value === null) continue;
      populatedCellCount += 1;
      minimum = Math.min(minimum, value);
      maximum = Math.max(maximum, value);
    }
  }

  return {
    xField,
    yField,
    valueField,
    xLabels,
    yLabels,
    cells,
    minimum: Number.isFinite(minimum) ? minimum : 0,
    maximum: Number.isFinite(maximum) ? maximum : 0,
    populatedCellCount,
  };
};

export const getVisibleTableFields = (dataset: Dataset, widget: Widget) => {
  const configuredFields = widget.config?.columns?.filter((name) => findField(dataset, name));
  const fields = configuredFields?.length ? configuredFields : dataset.fields.map((field) => field.name);
  return fields.slice(0, widget.config?.limit ?? 6);
};

const parseDateValue = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    const date = new Date(excelEpoch + value * 86400000);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const findFieldByName = (dataset: Dataset, patterns: RegExp[]) => dataset.fields.find((field) => patterns.some((pattern) => pattern.test(field.name)));

const getRowPeriod = (dataset: Dataset, row: Dataset['rows'][number]) => {
  const dateField = dataset.fields.find((field) => field.type === 'date') ?? findFieldByName(dataset, [/^date$/i, /date/i]);
  const date = dateField ? parseDateValue(row[dateField.name]) : null;

  if (date) {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    return {
      key: `${year}-${String(month).padStart(2, '0')}`,
      label: 'mois dernier',
      sort: year * 100 + month,
    };
  }

  const yearField = findFieldByName(dataset, [/^year$/i, /^annee$/i, /^année$/i]);
  const monthField = findFieldByName(dataset, [/month\s*number/i, /^month$/i, /^mois$/i, /^mois\s*numero$/i, /^mois\s*numéro$/i]);
  const year = yearField ? asNumber(row[yearField.name]) : null;
  const month = monthField ? asNumber(row[monthField.name]) : null;

  if (year !== null && month !== null && month >= 1 && month <= 12) {
    return {
      key: `${Math.trunc(year)}-${String(Math.trunc(month)).padStart(2, '0')}`,
      label: 'mois dernier',
      sort: Math.trunc(year) * 100 + Math.trunc(month),
    };
  }

  if (year !== null) {
    return {
      key: String(Math.trunc(year)),
      label: 'année précédente',
      sort: Math.trunc(year),
    };
  }

  return null;
};

export const buildKpiTrend = (dataset: Dataset, widget: Widget): KpiTrend => {
  const config = getWidgetConfig(widget, dataset);
  const valueField = config.yField ?? widget.field;
  const periods = new Map<string, { label: string; sort: number; values: number[]; rowCount: number }>();

  dataset.rows.forEach((row) => {
    const period = getRowPeriod(dataset, row);
    if (!period) return;

    const bucket = periods.get(period.key) ?? { label: period.label, sort: period.sort, values: [], rowCount: 0 };
    const numericValue = asNumber(row[valueField]);
    bucket.rowCount += 1;
    if (numericValue !== null) bucket.values.push(numericValue);
    periods.set(period.key, bucket);
  });

  const sortedPeriods = [...periods.values()].sort((a, b) => a.sort - b.sort);
  if (sortedPeriods.length < 2) {
    return { text: 'Tendance indisponible', direction: 'unavailable' };
  }

  const previousPeriod = sortedPeriods[sortedPeriods.length - 2];
  const currentPeriod = sortedPeriods[sortedPeriods.length - 1];
  const previous = aggregateValues(previousPeriod.values, widget.aggregation, previousPeriod.rowCount);
  const current = aggregateValues(currentPeriod.values, widget.aggregation, currentPeriod.rowCount);

  if (!Number.isFinite(previous) || !Number.isFinite(current) || previous === 0) {
    return { text: 'Tendance indisponible', direction: 'unavailable', current, previous };
  }

  const delta = ((current - previous) / Math.abs(previous)) * 100;
  const direction: KpiTrend['direction'] = delta > 0.05 ? 'up' : delta < -0.05 ? 'down' : 'flat';
  const arrow = direction === 'up' ? '▲' : direction === 'down' ? '▼' : '■';
  const signed = delta > 0 ? '+' : '';
  const text = `${arrow} ${signed}${delta.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} % vs ${currentPeriod.label}`;

  return { text, direction, current, previous };
};
