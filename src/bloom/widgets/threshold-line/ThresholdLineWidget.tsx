import { registerWidget } from '../../registry';
import type { WidgetProps } from '../../types';
import { asNumber, colorFor, EmptyWidgetState, formatNumber, readString } from '../shared';

type Point = { id: string; label: string; value: number };

export function ThresholdLineWidget({ data, config }: WidgetProps) {
  const points: Point[] = [];
  for (const row of data.rows) {
    const value = asNumber(row.value);
    if (value === null) continue;
    const label = readString(row, 'label');
    points.push({ id: `${label}-${value}-${points.length}`, label, value });
  }
  if (points.length === 0) return <EmptyWidgetState message="Aucune valeur exploitable pour la courbe à seuils." />;
  const meta = data.rows[0];
  const minimum = asNumber(meta.minimum) ?? 0;
  const warning = asNumber(meta.warning) ?? 100;
  const critical = asNumber(meta.critical) ?? 250;
  const direction = readString(meta, 'direction', 'higher-is-worse');
  let maximum = asNumber(meta.maximum) ?? 400;
  let peak = points[0];
  for (const point of points) { maximum = Math.max(maximum, point.value); if (point.value > peak.value) peak = point; }
  maximum = Math.max(maximum, critical * 1.1, minimum + 1);
  const x = (index: number) => 12 + (index / Math.max(points.length - 1, 1)) * 316;
  const y = (value: number) => 124 - ((value - minimum) / (maximum - minimum)) * 112;
  const polyline = points.map((point, index) => `${x(index)},${y(point.value)}`).join(' ');
  const last = points[points.length - 1];
  const unit = readString(meta, 'unit');
  const bands = buildBands(direction, minimum, maximum, warning, critical);
  return (
    <div className="threshold-line-widget">
      <svg className="threshold-line-chart" viewBox="0 0 340 138" preserveAspectRatio="none" role="img" aria-label={`${config.title}. Dernière valeur ${formatNumber(last.value)} ${unit}.`}>
        {bands.map((band) => <rect className={`threshold-band ${band.severity}`} key={band.severity} x="0" y={y(band.high)} width="340" height={Math.max(y(band.low) - y(band.high), 0)} />)}
        <line className="threshold-rule warning" x1="0" x2="340" y1={y(warning)} y2={y(warning)} />
        <line className="threshold-rule critical" x1="0" x2="340" y1={y(critical)} y2={y(critical)} />
        <polyline className="threshold-series" points={polyline} />
        <circle cx={x(points.length - 1)} cy={y(last.value)} r="4" fill={colorFor(config, readString(meta, 'severity', 'healthy'), 0)}><title>{last.label}: {formatNumber(last.value)} {unit}</title></circle>
      </svg>
      <div className="threshold-line-summary"><strong>Pic à {formatNumber(peak.value)} {unit}</strong><span>{peak.label}</span></div>
    </div>
  );
}

function buildBands(direction: string, minimum: number, maximum: number, warning: number, critical: number) {
  if (direction === 'lower-is-worse') {
    return [
      { severity: 'critical', low: minimum, high: critical },
      { severity: 'warning', low: critical, high: warning },
      { severity: 'healthy', low: warning, high: maximum },
    ];
  }
  return [
    { severity: 'healthy', low: minimum, high: warning },
    { severity: 'warning', low: warning, high: critical },
    { severity: 'critical', low: critical, high: maximum },
  ];
}

registerWidget('threshold-line', { render: (data, config) => <ThresholdLineWidget data={data} config={config} />, defaultSize: 'md' });
