import { registerWidget } from '../../registry';
import type { WidgetProps } from '../../types';
import { EmptyWidgetState, formatNumber, readNumber, readString } from '../shared';

export function KpiWidget({ data }: WidgetProps) {
  const row = data.rows[0];
  if (!row) return <EmptyWidgetState message="Aucune mesure disponible pour ce KPI." />;
  const direction = readString(row, 'trendDirection', 'neutral');
  return (
    <div className="kpi-body">
      <strong>{formatNumber(readNumber(row, 'value'))}</strong>
      <span>{readString(row, 'label')}</span>
      <em className={`kpi-trend ${direction}`}>{readString(row, 'trendText', 'Tendance indisponible')}</em>
    </div>
  );
}

registerWidget('kpi', { render: (data, config) => <KpiWidget data={data} config={config} />, defaultSize: 'xs' });
