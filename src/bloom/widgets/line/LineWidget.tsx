import { useId } from 'react';
import { registerWidget } from '../../registry';
import type { WidgetProps } from '../../types';
import { canonicalRows, EmptyWidgetState, formatCompactNumber, formatNumber } from '../shared';

const plot = { left: 48, right: 346, top: 12, bottom: 142 } as const;

export function LineWidget({ data, config }: WidgetProps) {
  const gradientId = `bloom-line-area-${useId().replace(/:/g, '')}`;
  const entries = canonicalRows(data, config);
  if (entries.length === 0) return <EmptyWidgetState />;
  const scale = buildScale(entries);
  const position = (value: number, index: number) => ({
    x: plot.left + (index / Math.max(entries.length - 1, 1)) * (plot.right - plot.left),
    y: plot.bottom - ((value - scale.minimum) / (scale.maximum - scale.minimum)) * (plot.bottom - plot.top),
  });
  const positions = entries.map((entry, index) => position(entry.value, index));
  const polyline = positions.map((point) => `${point.x},${point.y}`).join(' ');
  const area = `M ${positions[0].x} ${plot.bottom} L ${polyline} L ${positions[positions.length - 1].x} ${plot.bottom} Z`;
  const last = entries[entries.length - 1];
  const lastPosition = positions[positions.length - 1];
  const tickIndices = buildXAxisTickIndices(entries.length);
  const years = new Set<number>();
  for (const entry of entries) {
    const date = parseDate(entry.label);
    if (date) years.add(date.getUTCFullYear());
  }
  const calloutX = Math.max(plot.left, lastPosition.x - 51);
  const calloutY = Math.max(plot.top, Math.min(lastPosition.y - 26, plot.bottom - 18));
  return (
    <div className="line-chart-wrap">
      <svg className="line-chart" viewBox="0 0 360 170" role="img" aria-label={`${config.title}. Dernière valeur ${formatNumber(last.value)}.`}>
        <defs><linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--line-c)" stopOpacity="0.28" /><stop offset="100%" stopColor="var(--line-c)" stopOpacity="0.02" /></linearGradient></defs>
        <g className="line-grid" aria-hidden="true">{scale.ticks.map((tick) => { const y = position(tick, 0).y; return <g key={tick}><line x1={plot.left} x2={plot.right} y1={y} y2={y} /><text x={plot.left - 8} y={y + 3} textAnchor="end">{formatCompactNumber(tick)}</text></g>; })}</g>
        <path className="line-area" d={area} fill={`url(#${gradientId})`} />
        <polyline className="line-series" points={polyline} fill="none" />
        {entries.map((entry, index) => <circle className={`line-point${index === entries.length - 1 ? ' last' : ''}`} key={entry.label} cx={positions[index].x} cy={positions[index].y} r={index === entries.length - 1 ? 4 : 2.5}><title>{entry.label}: {formatNumber(entry.value)}</title></circle>)}
        <g className="line-last-callout" aria-hidden="true"><rect x={calloutX} y={calloutY} width="44" height="18" rx="6" /><text x={calloutX + 22} y={calloutY + 12} textAnchor="middle">{formatCompactNumber(last.value)}</text></g>
        <g className="line-x-axis" aria-hidden="true">{tickIndices.map((index) => <text key={entries[index].label} x={positions[index].x} y="163" textAnchor={index === 0 ? 'start' : index === entries.length - 1 ? 'end' : 'middle'}>{formatAxisLabel(entries[index].label, years.size > 1)}</text>)}</g>
      </svg>
    </div>
  );
}

function buildScale(entries: { value: number }[]) {
  let rawMinimum = entries[0].value;
  let rawMaximum = entries[0].value;
  for (const entry of entries) { rawMinimum = Math.min(rawMinimum, entry.value); rawMaximum = Math.max(rawMaximum, entry.value); }
  const range = Math.max(rawMaximum - rawMinimum, Math.abs(rawMaximum) * 0.1, 1);
  const paddedMinimum = rawMinimum >= 0 ? Math.max(0, rawMinimum - range * 0.08) : rawMinimum - range * 0.08;
  const paddedMaximum = rawMaximum + range * 0.08;
  const roughStep = Math.max((paddedMaximum - paddedMinimum) / 4, Number.EPSILON);
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;
  const step = (normalized >= 7.5 ? 10 : normalized >= 3.5 ? 5 : normalized >= 1.5 ? 2 : 1) * magnitude;
  const minimum = rawMinimum >= 0 ? Math.max(0, Math.floor(paddedMinimum / step) * step) : Math.floor(paddedMinimum / step) * step;
  const maximum = Math.max(minimum + step, Math.ceil(paddedMaximum / step) * step);
  const ticks: number[] = [];
  for (let value = minimum; value <= maximum + step / 2 && ticks.length < 8; value += step) ticks.push(Number(value.toPrecision(12)));
  return { minimum, maximum, ticks };
}

function buildXAxisTickIndices(length: number) {
  if (length <= 1) return [0];
  const count = Math.min(length, 5);
  const indices = new Set<number>();
  for (let index = 0; index < count; index += 1) indices.add(Math.round((index / (count - 1)) * (length - 1)));
  return [...indices];
}

const monthLabels = new Map([['january', 'janv.'], ['february', 'févr.'], ['march', 'mars'], ['april', 'avr.'], ['may', 'mai'], ['june', 'juin'], ['july', 'juil.'], ['august', 'août'], ['september', 'sept.'], ['october', 'oct.'], ['november', 'nov.'], ['december', 'déc.']]);
const parseDate = (label: string) => { if (!/^\d{4}-\d{1,2}-\d{1,2}/.test(label)) return null; const date = new Date(label); return Number.isNaN(date.getTime()) ? null : date; };
const formatAxisLabel = (label: string, includeYear: boolean) => { const date = parseDate(label); return date ? date.toLocaleDateString('fr-FR', { month: 'short', ...(includeYear ? { year: '2-digit' as const } : {}) }) : monthLabels.get(label.trim().toLowerCase()) ?? label; };

registerWidget('line', { render: (data, config) => <LineWidget data={data} config={config} />, defaultSize: 'md' });
