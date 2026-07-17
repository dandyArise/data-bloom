import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { widgetRegistry, type WidgetConfig, type WidgetData } from '../index';
import './harness.css';

const data: WidgetData = {
  fields: [{ name: 'label', type: 'string' }, { name: 'value', type: 'number' }],
  rows: [
    { label: 'Government', value: 418_000 },
    { label: 'Midmarket', value: 146_000 },
    { label: 'Channel Partners', value: 132_000 },
    { label: 'Enterprise', value: 124_000 },
    { label: 'Small Business', value: 109_000 },
  ],
};

const config: WidgetConfig = {
  type: 'bar',
  title: 'Ventes par segment',
  dimension: 'label',
  measure: 'value',
  aggregation: 'sum',
  size: 'md',
  colorScheme: (_label, index) => ['var(--seg-government)', 'var(--seg-midmarket)', 'var(--seg-channel)', 'var(--seg-enterprise)', 'var(--seg-small-biz)'][index % 5],
};

function BloomHarness() {
  const definition = widgetRegistry.get(config.type);
  if (!definition) return <p role="alert">Widget non enregistré : {config.type}</p>;
  return (
    <section className="harness-card">
      <header><h1>{config.title}</h1><p>Rendu autonome depuis bloom/index.ts</p></header>
      <div className="harness-widget">{definition.render(data, config)}</div>
    </section>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<StrictMode><BloomHarness /></StrictMode>);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
