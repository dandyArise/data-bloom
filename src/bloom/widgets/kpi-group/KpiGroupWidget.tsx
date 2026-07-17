import { registerWidget } from '../../registry';
import type { WidgetProps } from '../../types';
import { EmptyWidgetState, formatNumber, readNumber, readString } from '../shared';

export function KpiGroupWidget({ data }: WidgetProps) {
  if (data.rows.length === 0) return <EmptyWidgetState message="Aucune mesure valide pour ce groupe de KPI." />;
  return (
    <div className="kpi-group-body">
      {data.rows.map((row) => {
        const label = readString(row, 'label');
        return (
          <div className="kpi-group-item" key={label}>
            <span>{label}</span>
            <strong>{formatNumber(readNumber(row, 'value'))}</strong>
            <small>{readString(row, 'aggregationLabel')}</small>
          </div>
        );
      })}
    </div>
  );
}

registerWidget('kpi-group', { render: (data, config) => <KpiGroupWidget data={data} config={config} />, defaultSize: 'lg' });
