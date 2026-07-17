import type { WidgetConfig, WidgetData, WidgetRender } from './types';

export interface WidgetDefinition {
  render: WidgetRender;
  defaultSize: WidgetConfig['size'];
}

export const widgetRegistry = new Map<string, WidgetDefinition>();

export function registerWidget(type: string, definition: WidgetDefinition) {
  widgetRegistry.set(type, definition);
}

export function renderWidget(type: string, data: WidgetData, config: WidgetConfig) {
  return widgetRegistry.get(type)?.render(data, config);
}
