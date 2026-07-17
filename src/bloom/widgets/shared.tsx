import type { WidgetConfig, WidgetData } from '../types';

export function EmptyWidgetState({ message = 'Aucune donnée numérique disponible.' }: { message?: string }) {
  return <p className="empty-state bloom-empty-state">{message}</p>;
}

export function asNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Number(value.replace(/[€$£%]/g, '').replace(/\s/g, '').replace(/,(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

export function readNumber(row: Record<string, unknown> | undefined, key: string, fallback = 0) {
  return asNumber(row?.[key]) ?? fallback;
}

export function readString(row: Record<string, unknown> | undefined, key: string, fallback = '') {
  const value = row?.[key];
  return value == null ? fallback : String(value);
}

export function formatNumber(value: number) {
  return value.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
}

export function formatCompactNumber(value: number) {
  return Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

export function colorFor(config: WidgetConfig, label: string, index: number, fallback = 'var(--accent)') {
  return config.colorScheme?.(label, index) ?? fallback;
}

export function canonicalRows(data: WidgetData, config: WidgetConfig) {
  const dimension = config.dimension ?? 'label';
  const measure = config.measure ?? 'value';
  const rows: { label: string; value: number }[] = [];
  for (const row of data.rows) {
    const value = asNumber(row[measure]);
    if (value === null) continue;
    rows.push({ label: readString(row, dimension, '—'), value });
  }
  return rows;
}
