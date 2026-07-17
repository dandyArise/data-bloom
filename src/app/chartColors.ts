import type { WidgetThresholds } from './types';

export type ThresholdSeverity = 'healthy' | 'warning' | 'critical';
export type ServiceStatus = 'up' | 'degraded' | 'down' | 'unknown';

const categoricalPalette = [
  'var(--accent)',
  'var(--country-c)',
  'var(--line-c)',
  'var(--seg-channel)',
  'var(--seg-enterprise)',
  'var(--seg-small-biz)',
  'var(--neg)',
];

export function getCategoricalColor(label: string, index = 0, groupField = '', valueField = '') {
  const groupKey = groupField.toLowerCase();
  const valueKey = valueField.toLowerCase();
  const labelKey = label.toLowerCase();

  if (/profit|marge|margin/.test(valueKey)) return 'var(--pos)';
  if (/discount/.test(valueKey)) return 'var(--neg)';
  if (/sales|revenue|gross|units/.test(valueKey) && !/segment/.test(groupKey)) return 'var(--country-c)';

  if (/segment/.test(groupKey)) {
    if (labelKey.includes('government')) return 'var(--seg-government)';
    if (labelKey.includes('midmarket')) return 'var(--seg-midmarket)';
    if (labelKey.includes('channel')) return 'var(--seg-channel)';
    if (labelKey.includes('enterprise')) return 'var(--seg-enterprise)';
    if (labelKey.includes('small business') || labelKey.includes('small')) return 'var(--seg-small-biz)';
  }

  return categoricalPalette[index % categoricalPalette.length];
}

export function getThresholdSeverity(value: number, thresholds: WidgetThresholds): ThresholdSeverity {
  if (thresholds.direction === 'lower-is-worse') {
    if (value <= thresholds.critical) return 'critical';
    if (value <= thresholds.warning) return 'warning';
    return 'healthy';
  }

  if (value >= thresholds.critical) return 'critical';
  if (value >= thresholds.warning) return 'warning';
  return 'healthy';
}

export function getThresholdColor(value: number, thresholds: WidgetThresholds) {
  const severity = getThresholdSeverity(value, thresholds);
  if (severity === 'critical') return 'var(--db-neg)';
  if (severity === 'warning') return 'var(--db-warn)';
  return 'var(--db-pos)';
}

export function getStatusColor(status: ServiceStatus) {
  if (status === 'up') return 'var(--db-pos)';
  if (status === 'degraded') return 'var(--db-warn)';
  if (status === 'down') return 'var(--db-neg)';
  return 'var(--db-muted)';
}
