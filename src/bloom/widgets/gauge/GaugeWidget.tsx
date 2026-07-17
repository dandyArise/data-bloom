import { registerWidget } from '../../registry';
import type { WidgetProps } from '../../types';
import { colorFor, EmptyWidgetState, formatNumber, readNumber, readString } from '../shared';

export function GaugeWidget({ data, config }: WidgetProps) {
  const row = data.rows[0];
  if (!row) return <EmptyWidgetState message="Aucune mesure disponible pour la jauge." />;
  const value = readNumber(row, 'value');
  const minimum = readNumber(row, 'minimum');
  const maximum = Math.max(readNumber(row, 'maximum', 1), minimum + 1);
  const progress = Math.min(Math.max((value - minimum) / (maximum - minimum), 0), 1);
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const severity = readString(row, 'severity', 'healthy');
  const unit = readString(row, 'unit');
  const formatted = unit ? `${formatNumber(value)} ${unit}` : formatNumber(value);
  return (
    <div className="radial-gauge-widget" role="img" aria-label={`${config.title}: ${formatted}, ${readString(row, 'severityLabel')}.`}>
      <div className="radial-gauge-visual"><svg viewBox="0 0 110 110" aria-hidden="true"><circle className="radial-gauge-track" cx="55" cy="55" r={radius} /><circle className="radial-gauge-progress" cx="55" cy="55" r={radius} stroke={colorFor(config, severity, 0)} strokeDasharray={`${progress * circumference} ${circumference}`} /></svg><strong>{formatted}</strong></div>
      <div className="radial-gauge-copy"><span>Échelle {formatNumber(minimum)}–{formatNumber(maximum)} {unit}</span><strong className={severity}>{readString(row, 'thresholdLabel')}</strong></div>
    </div>
  );
}

registerWidget('radial-gauge', { render: (data, config) => <GaugeWidget data={data} config={config} />, defaultSize: 'sm' });
