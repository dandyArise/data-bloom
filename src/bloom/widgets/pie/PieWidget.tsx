import type { CSSProperties } from 'react';
import { registerWidget } from '../../registry';
import type { WidgetProps } from '../../types';
import { canonicalRows, colorFor, EmptyWidgetState, formatNumber } from '../shared';

export function PieWidget({ data, config }: WidgetProps) {
  const entries = canonicalRows(data, config);
  let total = 0;
  for (const entry of entries) total += Math.max(entry.value, 0);
  if (entries.length === 0 || total <= 0) return <EmptyWidgetState message="Aucune valeur positive à répartir dans ce graphique." />;
  let cursor = 0;
  const segments: string[] = [];
  for (let index = 0; index < entries.length; index += 1) {
    const start = cursor;
    cursor += (Math.max(entries[index].value, 0) / total) * 100;
    segments.push(`${colorFor(config, entries[index].label, index)} ${start}% ${cursor}%`);
  }
  return (
    <div className="pie-wrap">
      <div className="pie-chart" role="img" aria-label={config.title} style={{ '--pie-segments': `conic-gradient(${segments.join(', ')})` } as CSSProperties} />
      <div className="legend">{entries.map((entry, index) => <span key={entry.label}><i style={{ background: colorFor(config, entry.label, index) }} />{entry.label} ({formatNumber(entry.value)})</span>)}</div>
    </div>
  );
}

registerWidget('pie', { render: (data, config) => <PieWidget data={data} config={config} />, defaultSize: 'sm' });
