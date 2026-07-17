import type { CSSProperties } from 'react';
import { registerWidget } from '../../registry';
import type { WidgetProps } from '../../types';
import { colorFor, EmptyWidgetState, readString } from '../shared';

const statusLabels = new Map([['up', 'En ligne'], ['degraded', 'Dégradé'], ['down', 'Hors ligne'], ['unknown', 'Inconnu']]);

export function StatusWidget({ data, config }: WidgetProps) {
  const row = data.rows[0];
  if (!row) return <EmptyWidgetState message="Aucun contrôle de service disponible." />;
  const status = readString(row, 'status', 'unknown');
  return (
    <div className={`service-status-widget ${status}`} style={{ '--status-color': colorFor(config, status, 0, 'var(--muted)') } as CSSProperties} role="status" aria-live="polite">
      <div className="service-status-copy"><strong>{readString(row, 'host')}</strong><span>{readString(row, 'summary')}</span>{readString(row, 'message') ? <small>{readString(row, 'message')}</small> : null}</div>
      <span className="service-status-pill"><i aria-hidden="true" />{statusLabels.get(status) ?? 'Inconnu'}</span>
    </div>
  );
}

registerWidget('service-status', { render: (data, config) => <StatusWidget data={data} config={config} />, defaultSize: 'sm' });
