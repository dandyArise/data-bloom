import { registerWidget } from '../../registry';
import type { WidgetProps } from '../../types';
import { EmptyWidgetState, readString } from '../shared';

const statusLabels = new Map([['up', 'disponible'], ['degraded', 'dégradé'], ['down', 'indisponible'], ['unknown', 'état inconnu']]);

export function AvailabilityGridWidget({ data, config }: WidgetProps) {
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const row of data.rows) {
    const host = readString(row, 'host');
    const events = groups.get(host) ?? [];
    events.push(row);
    groups.set(host, events);
  }
  if (groups.size === 0) return <EmptyWidgetState message="Aucun événement de disponibilité à afficher." />;
  const limit = Math.min(Math.max(config.limit ?? 12, 2), 48);
  return (
    <table className="availability-grid-widget" aria-label={config.title}>
      <tbody>{[...groups.entries()].map(([host, events]) => <tr className="availability-row" key={host}><th scope="row" title={host}>{host}</th><td className="availability-cells">{events.slice(-limit).map((event) => { const status = readString(event, 'status', 'unknown'); const time = readString(event, 'label', 'Heure inconnue'); const id = readString(event, 'id', `${host}-${time}-${status}`); return <span className={`availability-cell ${status}`} key={id} role="img" title={`${time} · ${statusLabels.get(status) ?? 'état inconnu'}`} aria-label={`${time}, ${statusLabels.get(status) ?? 'état inconnu'}`} />; })}</td></tr>)}</tbody>
    </table>
  );
}

registerWidget('availability-grid', { render: (data, config) => <AvailabilityGridWidget data={data} config={config} />, defaultSize: 'md' });
