import { registerWidget } from '../../registry';
import type { WidgetProps } from '../../types';
import { readString } from '../shared';

export function TextWidget({ data }: WidgetProps) {
  return <p className="insight-text">{readString(data.rows[0], 'text', 'Aucun insight disponible.')}</p>;
}

registerWidget('text', { render: (data, config) => <TextWidget data={data} config={config} />, defaultSize: 'sm' });
