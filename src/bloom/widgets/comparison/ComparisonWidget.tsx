import { registerWidget } from '../../registry';
import type { WidgetProps } from '../../types';
import { EmptyWidgetState, formatNumber, readNumber, readString } from '../shared';

export function ComparisonWidget({ data }: WidgetProps) {
  if (data.rows.length < 2) return <EmptyWidgetState message="Deux périodes sont nécessaires pour afficher la comparaison." />;
  const current = data.rows[0];
  const previous = data.rows[1];
  return (
    <div className="comparison-body">
      <div className="comparison-values">
        <div><span>{readString(current, 'label', 'Actuel')}</span><strong>{formatNumber(readNumber(current, 'value'))}</strong></div>
        <div><span>{readString(previous, 'label', 'Précédent')}</span><strong>{formatNumber(readNumber(previous, 'value'))}</strong></div>
      </div>
      <em className={`comparison-delta ${readString(current, 'trendDirection', 'neutral')}`}>{readString(current, 'trendText')}</em>
      <small>{readString(current, 'aggregationLabel')}</small>
    </div>
  );
}

registerWidget('comparison', { render: (data, config) => <ComparisonWidget data={data} config={config} />, defaultSize: 'sm' });
