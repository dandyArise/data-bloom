import type { CSSProperties } from 'react';
import { registerWidget } from '../../registry';
import type { WidgetProps } from '../../types';
import { asNumber, EmptyWidgetState, formatCompactNumber, readString } from '../shared';

type HeatmapStyle = CSSProperties & { '--heatmap-color': string; '--heatmap-text': string };

export function HeatmapWidget({ data, config }: WidgetProps) {
  const xLabels: string[] = [];
  const yLabels: string[] = [];
  const cells = new Map<string, number | null>();
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  for (const row of data.rows) {
    const xLabel = readString(row, 'column');
    const yLabel = readString(row, 'row');
    const value = asNumber(row.value);
    if (!xLabels.includes(xLabel)) xLabels.push(xLabel);
    if (!yLabels.includes(yLabel)) yLabels.push(yLabel);
    cells.set(JSON.stringify([yLabel, xLabel]), value);
    if (value !== null) { minimum = Math.min(minimum, value); maximum = Math.max(maximum, value); }
  }
  if (xLabels.length === 0 || yLabels.length === 0) return <EmptyWidgetState message="Deux dimensions distinctes sont nécessaires pour construire la heatmap." />;
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) return <EmptyWidgetState message="Aucune valeur ne peut être agrégée dans cette heatmap." />;
  const range = maximum - minimum;
  return (
    <div className="heatmap-widget">
      <div className="heatmap-scroll">
        <table className="heatmap-table">
          <caption className="visually-hidden">{config.title}</caption>
          <thead><tr><th scope="col">Ligne \ Colonne</th>{xLabels.map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
          <tbody>{yLabels.map((yLabel) => <tr key={yLabel}><th scope="row">{yLabel}</th>{xLabels.map((xLabel) => { const value = cells.get(JSON.stringify([yLabel, xLabel])) ?? null; const intensity = value === null ? 0 : range === 0 ? 0.72 : (value - minimum) / range; const level = Math.min(5, Math.max(1, Math.floor(intensity * 5) + 1)); return <td className={value === null ? 'heatmap-cell empty' : 'heatmap-cell'} key={xLabel} style={{ '--heatmap-color': `var(--heatmap-${level})`, '--heatmap-text': intensity >= 0.62 ? 'var(--surface)' : 'var(--ink)' } as HeatmapStyle} title={value === null ? `${yLabel} × ${xLabel} : aucune donnée` : `${yLabel} × ${xLabel} : ${value.toLocaleString('fr-FR')}`}>{value === null ? '—' : formatCompactNumber(value)}</td>; })}</tr>)}</tbody>
        </table>
      </div>
      <div className="heatmap-legend" aria-label={`Échelle de ${formatCompactNumber(minimum)} à ${formatCompactNumber(maximum)}`}><span>{formatCompactNumber(minimum)}</span><i aria-hidden="true" /><span>{formatCompactNumber(maximum)}</span></div>
    </div>
  );
}

registerWidget('heatmap', { render: (data, config) => <HeatmapWidget data={data} config={config} />, defaultSize: 'lg' });
