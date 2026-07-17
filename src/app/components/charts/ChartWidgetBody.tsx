import { widgetRegistry as bloomWidgetRegistry } from '@bloom/index';
import type { Dataset, Widget } from '../../types';
import { prepareBloomWidget } from '../../widgetDataAdapter';

export function ChartWidgetBody({ widget, dataset }: { widget: Widget; dataset: Dataset }) {
  const runtimeType = (widget as { type: string }).type;
  const prepared = prepareBloomWidget(widget, dataset);

  if (!prepared) return <UnknownWidgetState type={runtimeType} />;
  const definition = bloomWidgetRegistry.get(prepared.type);
  if (!definition) return <UnknownWidgetState type={prepared.type} />;
  return definition.render(prepared.data, prepared.config);
}

function UnknownWidgetState({ type }: { type: string }) {
  return (
    <div className="widget-error" role="alert">
      Type de widget inconnu : <code>{type}</code>
    </div>
  );
}
