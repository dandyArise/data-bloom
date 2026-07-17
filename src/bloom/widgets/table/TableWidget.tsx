import { registerWidget } from '../../registry';
import type { WidgetProps } from '../../types';
import { EmptyWidgetState } from '../shared';

export function TableWidget({ data, config }: WidgetProps) {
  if (data.fields.length === 0) return <EmptyWidgetState message="Aucune colonne n’est disponible pour ce tableau." />;
  const occurrences = new Map<string, number>();
  const rows = data.rows.slice(0, config.limit ?? 4).map((row) => {
    const fingerprint = JSON.stringify(data.fields.map((field) => [field.name, row[field.name] ?? null]));
    const occurrence = (occurrences.get(fingerprint) ?? 0) + 1;
    occurrences.set(fingerprint, occurrence);
    return { key: `${fingerprint}-${occurrence}`, row };
  });
  return (
    <div className="mini-table-scroll">
      <table className="mini-table">
        <thead><tr>{data.fields.map((field) => <th key={field.name}>{field.name}</th>)}</tr></thead>
        <tbody>{rows.map(({ key, row }) => <tr key={key}>{data.fields.map((field) => <td key={field.name}>{String(row[field.name] ?? '—')}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

registerWidget('table', { render: (data, config) => <TableWidget data={data} config={config} />, defaultSize: 'lg' });
