import type { Dataset, DatasetField, Widget, WidgetThresholds } from './types';
import type { ServiceStatus } from './chartColors';

export const latencyThresholdDefaults: WidgetThresholds = {
  warning: 100,
  critical: 250,
  min: 0,
  max: 400,
  direction: 'higher-is-worse',
};

export const percentageThresholdDefaults: WidgetThresholds = {
  warning: 1,
  critical: 5,
  min: 0,
  max: 10,
  direction: 'higher-is-worse',
};

function findField(
  dataset: Dataset,
  configured: string | undefined,
  patterns: RegExp[],
  type?: DatasetField['type'],
) {
  if (configured && dataset.fields.some((field) => field.name === configured)) return configured;
  return dataset.fields.find((field) => (!type || field.type === type) && patterns.some((pattern) => pattern.test(field.name)))?.name;
}

export function getMonitorValueField(dataset: Dataset, widget: Widget) {
  const configured = widget.config?.yField ?? widget.field;
  const configuredField = dataset.fields.find((field) => field.name === configured);
  if (configuredField?.type === 'number') return configuredField.name;
  return findField(dataset, undefined, [/latency/i, /latence/i, /response.*time/i, /packet.*loss/i, /perte/i, /error.*rate/i], 'number')
    ?? dataset.fields.find((field) => field.type === 'number')?.name;
}

export function getMonitorTimeField(dataset: Dataset, widget: Widget) {
  return findField(dataset, widget.config?.xField, [/checked.*at/i, /timestamp/i, /date/i, /time/i, /heure/i], 'date')
    ?? findField(dataset, widget.config?.xField, [/checked.*at/i, /timestamp/i, /date/i, /time/i, /heure/i]);
}

export function getMonitorStatusField(dataset: Dataset, widget: Widget) {
  const patterns = [/^status$/i, /state/i, /etat/i, /état/i, /availability/i, /disponibil/i];
  const configured = widget.config?.yField;
  if (configured && dataset.fields.some((field) => field.name === configured)) {
    const hasStatusName = patterns.some((pattern) => pattern.test(configured));
    const hasStatusValue = dataset.rows.some((row) => normalizeServiceStatus(row[configured]) !== 'unknown');
    if (hasStatusName || hasStatusValue) return configured;
  }
  return findField(dataset, undefined, patterns);
}

export function getMonitorHostField(dataset: Dataset, widget: Widget) {
  return findField(dataset, widget.config?.groupBy, [/host/i, /hostname/i, /target/i, /service/i, /endpoint/i, /url/i, /h[oô]te/i]);
}

export function getMonitorRows(dataset: Dataset, widget: Widget) {
  const hostField = getMonitorHostField(dataset, widget);
  const filterValue = widget.config?.filterValue;
  if (!hostField || !filterValue) return dataset.rows;
  return dataset.rows.filter((row) => String(row[hostField] ?? '') === filterValue);
}

export function getLatestMonitorRow(dataset: Dataset, widget: Widget) {
  const rows = getMonitorRows(dataset, widget);
  return rows[rows.length - 1];
}

export function asMonitorNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  const normalized = value
    .replace(/[€$£%]/g, '')
    .replace(/\s/g, '')
    .replace(/,(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeServiceStatus(value: unknown): ServiceStatus {
  const status = String(value ?? '').trim().toLowerCase();
  if (['up', 'online', 'ok', 'healthy', 'disponible', 'en ligne', 'success'].includes(status)) return 'up';
  if (['degraded', 'warning', 'warn', 'slow', 'dégradé', 'degrade', 'partiel'].includes(status)) return 'degraded';
  if (['down', 'offline', 'error', 'failed', 'indisponible', 'hors ligne', 'critical'].includes(status)) return 'down';
  return 'unknown';
}

export function resolveWidgetThresholds(widget: Widget, defaults: WidgetThresholds) {
  const configured = widget.config?.thresholds;
  const configuredWarning = Number.isFinite(configured?.warning) ? Number(configured?.warning) : defaults.warning;
  const configuredCritical = Number.isFinite(configured?.critical) ? Number(configured?.critical) : defaults.critical;
  const direction = configured?.direction ?? defaults.direction ?? 'higher-is-worse';
  const warning = direction === 'lower-is-worse'
    ? Math.max(configuredWarning, configuredCritical)
    : Math.min(configuredWarning, configuredCritical);
  const critical = direction === 'lower-is-worse'
    ? Math.min(configuredWarning, configuredCritical)
    : Math.max(configuredWarning, configuredCritical);
  const min = Number.isFinite(configured?.min) ? Number(configured?.min) : defaults.min ?? 0;
  const defaultMax = defaults.max ?? Math.max(warning, critical) * 1.25;
  const max = Number.isFinite(configured?.max) ? Number(configured?.max) : defaultMax;

  return {
    warning,
    critical,
    min,
    max: Math.max(max, min + 1),
    direction,
  } satisfies Required<WidgetThresholds>;
}

export function formatMonitorValue(value: number, unit = '') {
  const formatted = value.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  return unit ? `${formatted} ${unit}` : formatted;
}

export function formatRelativeCheck(value: unknown) {
  if (typeof value !== 'string') return 'heure inconnue';
  const checkedAt = new Date(value);
  if (Number.isNaN(checkedAt.getTime())) return value;
  const seconds = Math.max(0, Math.round((Date.now() - checkedAt.getTime()) / 1000));
  if (seconds < 60) return `il y a ${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return checkedAt.toLocaleDateString('fr-FR');
}
