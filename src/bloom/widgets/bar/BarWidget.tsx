import { useState, type CSSProperties } from 'react';
import { registerWidget } from '../../registry';
import type { WidgetProps } from '../../types';
import { canonicalRows, colorFor, EmptyWidgetState, formatCompactNumber, formatNumber } from '../shared';

export function BarWidget({ data, config }: WidgetProps) {
  const entries = canonicalRows(data, config);
  const [activeIndex, setActiveIndex] = useState(0);
  if (entries.length === 0) return <EmptyWidgetState />;
  let maximum = 1;
  for (const entry of entries) maximum = Math.max(maximum, Math.abs(entry.value));
  const resolvedActiveIndex = Math.min(activeIndex, entries.length - 1);
  return (
    <div className="chart-stack">
      <div className="bar-chart" role="group" aria-label={`Valeurs de ${config.dimension ?? 'la dimension'}`}>
        {entries.map((entry, index) => (
          <button
            type="button"
            key={entry.label}
            title={`${entry.label}: ${formatNumber(entry.value)}`}
            className={`bar-column${index === resolvedActiveIndex ? ' active' : ''}`}
            aria-label={`${entry.label} : ${formatNumber(entry.value)}. Mettre cette barre en avant.`}
            aria-pressed={index === resolvedActiveIndex}
            onClick={() => setActiveIndex(index)}
            onFocus={() => setActiveIndex(index)}
            onMouseEnter={() => setActiveIndex(index)}
            style={{ height: `${(Math.abs(entry.value) / maximum) * 100}%`, '--bar-color': colorFor(config, entry.label, index) } as CSSProperties}
          >
            <em>{formatCompactNumber(entry.value)}</em>
          </button>
        ))}
      </div>
      <div className="chart-axis-labels">{entries.map((entry) => <span key={entry.label}>{entry.label}</span>)}</div>
    </div>
  );
}

registerWidget('bar', { render: (data, config) => <BarWidget data={data} config={config} />, defaultSize: 'md' });
