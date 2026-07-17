import { registerWidget } from '../../registry';
import type { WidgetConfig, WidgetProps } from '../../types';
import { canonicalRows, colorFor, EmptyWidgetState, formatCompactNumber, formatNumber } from '../shared';

const CENTER = 120;
const RADIUS = 108;

export function PieWidget({ data, config }: WidgetProps) {
  const entries = canonicalRows(data, config).filter((entry) => entry.value > 0);
  const total = entries.reduce((sum, entry) => sum + entry.value, 0);
  if (entries.length === 0 || total <= 0) return <EmptyWidgetState message="Aucune valeur positive à répartir dans ce graphique." />;

  let cursor = -90;
  const segments = entries.map((entry, index) => {
    const ratio = entry.value / total;
    const startAngle = cursor;
    const endAngle = cursor + ratio * 360;
    cursor = endAngle;
    const labelRadius = RADIUS * (ratio < 0.12 ? 0.72 : 0.61);
    const labelPoint = polarPoint(CENTER, CENTER, labelRadius, startAngle + (endAngle - startAngle) / 2);
    return {
      ...entry,
      ratio,
      color: colorFor(config, entry.label, index),
      path: ratio >= 0.9999 ? null : arcPath(CENTER, CENTER, RADIUS, startAngle, endAngle),
      labelPoint,
    };
  });
  const legendPosition = config.legendPosition ?? 'right';
  const legendDetail = config.legendDetail ?? 'value_percentage';
  const sliceLabel = config.sliceLabel ?? 'label_percentage';
  const wrapClassName = `pie-wrap legend-${legendPosition}`;
  const accessibleSummary = segments.map((segment) => `${segment.label}: ${formatNumber(segment.value)}, ${formatPercentage(segment.ratio)}`).join('; ');

  return (
    <div className={wrapClassName}>
      <svg className="pie-chart" viewBox="0 0 240 240" role="img" aria-label={`${config.title}. ${accessibleSummary}`}>
        <title>{config.title}. {accessibleSummary}</title>
        {segments.map((segment) => segment.path
          ? <path key={segment.label} className="pie-slice" d={segment.path} fill={segment.color} />
          : <circle key={segment.label} className="pie-slice" cx={CENTER} cy={CENTER} r={RADIUS} fill={segment.color} />)}
        {sliceLabel !== 'none' && segments.map((segment) => {
          const lines = sliceLabelLines(segment.label, segment.value, segment.ratio, sliceLabel);
          const minimumRatio = sliceLabel.includes('label') ? 0.09 : 0.05;
          if (segment.ratio < minimumRatio) return null;
          const width = Math.min(108, Math.max(52, Math.max(...lines.map((line) => line.length)) * 6.8 + 18));
          const height = lines.length > 1 ? 38 : 24;
          return (
            <g key={`${segment.label}-label`} className="pie-slice-label" transform={`translate(${segment.labelPoint.x} ${segment.labelPoint.y})`} aria-hidden="true">
              <rect x={-width / 2} y={-height / 2} width={width} height={height} rx="7" />
              <text textAnchor="middle" y={lines.length > 1 ? -3 : 4}>
                {lines.map((line, index) => <tspan key={line} x="0" dy={index === 0 ? 0 : 14}>{line}</tspan>)}
              </text>
            </g>
          );
        })}
      </svg>
      {legendPosition !== 'none' && (
        <div className="pie-legend" aria-label="Légende du graphique">
          {segments.map((segment) => (
            <span key={segment.label}>
              <i style={{ background: segment.color }} />
              <span className="pie-legend-copy">
                <strong>{segment.label}</strong>
                {legendDetail !== 'label' && <small>{legendText(segment.value, segment.ratio, legendDetail)}</small>}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function polarPoint(cx: number, cy: number, radius: number, angle: number) {
  const radians = angle * Math.PI / 180;
  return {
    x: Math.round((cx + radius * Math.cos(radians)) * 100) / 100,
    y: Math.round((cy + radius * Math.sin(radians)) * 100) / 100,
  };
}

function arcPath(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarPoint(cx, cy, radius, startAngle);
  const end = polarPoint(cx, cy, radius, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

function formatPercentage(ratio: number) {
  return `${Intl.NumberFormat('fr-FR', { maximumFractionDigits: ratio < 0.1 ? 1 : 0 }).format(ratio * 100)} %`;
}

function shortLabel(label: string) {
  return label.length <= 14 ? label : `${label.slice(0, 13)}…`;
}

function sliceLabelLines(label: string, value: number, ratio: number, mode: NonNullable<WidgetConfig['sliceLabel']>) {
  if (mode === 'label') return [shortLabel(label)];
  if (mode === 'value') return [formatCompactNumber(value)];
  if (mode === 'label_percentage') return [shortLabel(label), formatPercentage(ratio)];
  return [formatPercentage(ratio)];
}

function legendText(value: number, ratio: number, detail: NonNullable<WidgetConfig['legendDetail']>) {
  if (detail === 'percentage') return formatPercentage(ratio);
  if (detail === 'value_percentage') return `${formatNumber(value)} · ${formatPercentage(ratio)}`;
  return formatNumber(value);
}

registerWidget('pie', { render: (data, config) => <PieWidget data={data} config={config} />, defaultSize: 'md' });
