import { useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { registerWidget } from '../../registry';
import type { WidgetProps } from '../../types';
import { canonicalRows, EmptyWidgetState, formatCompactNumber, formatNumber } from '../shared';

type ChartBounds = { width: number; height: number };

function useChartBounds() {
  const ref = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState<ChartBounds>({ width: 360, height: 170 });

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => {
      const { width, height } = element.getBoundingClientRect();
      if (width > 0 && height > 0) setBounds({ width: Math.round(width), height: Math.round(height) });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, bounds };
}

export function LineWidget({ data, config }: WidgetProps) {
  const gradientId = `bloom-line-area-${useId().replace(/:/g, '')}`;
  const { ref, bounds } = useChartBounds();
  const entries = canonicalRows(data, config);
  if (entries.length === 0) return <EmptyWidgetState />;
  const compact = bounds.width < 460;
  const fontSize = Math.max(10, Math.min(13, bounds.width / 44));
  const plot = {
    left: compact ? 42 : 52,
    right: Math.max(compact ? 12 : 18, bounds.width - (compact ? 12 : 18)),
    top: 16,
    bottom: Math.max(72, bounds.height - (compact ? 34 : 30)),
  };
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
  const calloutText = formatCompactNumber(last.value);
  const calloutWidth = Math.max(46, calloutText.length * (fontSize * 0.62) + 16);
  const calloutX = Math.max(plot.left, Math.min(lastPosition.x - calloutWidth - 8, plot.right - calloutWidth));
  const calloutY = Math.max(plot.top, Math.min(lastPosition.y - 24, plot.bottom - 20));
  return (
    <div className="line-chart-wrap" ref={ref}>
      <svg className="line-chart" viewBox={`0 0 ${bounds.width} ${bounds.height}`} role="img" aria-label={`${config.title}. Dernière valeur ${formatNumber(last.value)}.`} style={{ '--line-axis-font-size': `${fontSize}px` } as CSSProperties}>
        <defs><linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--line-c)" stopOpacity="0.28" /><stop offset="100%" stopColor="var(--line-c)" stopOpacity="0.02" /></linearGradient></defs>
        <g className="line-grid" aria-hidden="true">{scale.ticks.map((tick) => { const y = position(tick, 0).y; return <g key={tick}><line x1={plot.left} x2={plot.right} y1={y} y2={y} /><text x={plot.left - 8} y={y + fontSize * 0.35} textAnchor="end" fontSize={fontSize}>{formatCompactNumber(tick)}</text></g>; })}</g>
        <path className="line-area" d={area} fill={`url(#${gradientId})`} />
        <polyline className="line-series" points={polyline} fill="none" />
        {entries.map((entry, index) => <circle className={`line-point${index === entries.length - 1 ? ' last' : ''}`} key={entry.label} cx={positions[index].x} cy={positions[index].y} r={index === entries.length - 1 ? 5 : 3.5}><title>{entry.label}: {formatNumber(entry.value)}</title></circle>)}
        <g className="line-last-callout" aria-hidden="true"><rect x={calloutX} y={calloutY} width={calloutWidth} height="20" rx="6" /><text x={calloutX + calloutWidth / 2} y={calloutY + 13.5} textAnchor="middle" fontSize={fontSize}>{calloutText}</text></g>
        <g className="line-x-axis" aria-hidden="true">{tickIndices.map((index) => <text key={entries[index].label} x={positions[index].x} y={bounds.height - 9} textAnchor={index === 0 ? 'start' : index === entries.length - 1 ? 'end' : 'middle'} fontSize={fontSize}>{formatAxisLabel(entries[index].label, years.size > 1)}</text>)}</g>
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
