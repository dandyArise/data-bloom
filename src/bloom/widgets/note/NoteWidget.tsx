import { registerWidget } from '../../registry';
import type { WidgetProps } from '../../types';
import { readString } from '../shared';

export function NoteWidget({ data }: WidgetProps) {
  const text = readString(data.rows[0], 'text');
  return <div className="note-body"><p className={text ? undefined : 'note-placeholder'}>{text || 'Ajoutez une note depuis l’inspecteur.'}</p></div>;
}

registerWidget('note', { render: (data, config) => <NoteWidget data={data} config={config} />, defaultSize: 'sm' });
