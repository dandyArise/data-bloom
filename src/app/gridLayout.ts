import type { Widget, WidgetType } from './types';
import { getWidgetDefinition } from './widgetRegistry';

export const GRID_COLUMNS = 12;
export type GridRect = Pick<Widget, 'x' | 'y' | 'w' | 'h'>;

const fallbackWidgetSize: Pick<GridRect, 'w' | 'h'> = { w: 4, h: 3 };

export const getGridSize = (type: WidgetType) => getWidgetDefinition(type)?.defaultSize ?? fallbackWidgetSize;
export const clampGridRect = (rect: GridRect): GridRect => ({
  x: Math.max(0, Math.min(GRID_COLUMNS - Math.max(1, Math.min(rect.w, GRID_COLUMNS)), Math.round(rect.x))),
  y: Math.max(0, Math.round(rect.y)),
  w: Math.max(1, Math.min(GRID_COLUMNS, Math.round(rect.w))),
  h: Math.max(1, Math.round(rect.h)),
});

export const overlaps = (left: GridRect, right: GridRect) => left.x < right.x + right.w && left.x + left.w > right.x && left.y < right.y + right.h && left.y + left.h > right.y;
export const collides = (candidate: GridRect, widgets: Widget[], ignoredId?: string) => widgets.some((widget) => widget.id !== ignoredId && overlaps(candidate, widget));

export const findFirstFit = (size: Pick<GridRect, 'w' | 'h'>, widgets: Widget[]) => {
  for (let y = 0; y < 200; y += 1) {
    for (let x = 0; x <= GRID_COLUMNS - size.w; x += 1) {
      const candidate = { x, y, ...size };
      if (!collides(candidate, widgets)) return candidate;
    }
  }
  return { x: 0, y: widgets.length + 1, ...size };
};

export const migrateWidgetToGrid = (widget: Widget): Widget => {
  if (widget.x <= GRID_COLUMNS && widget.w <= GRID_COLUMNS) return { ...widget, ...clampGridRect(widget) };
  const size = getGridSize(widget.type);
  return { ...widget, x: widget.x < 500 ? 0 : GRID_COLUMNS - size.w, y: Math.max(0, Math.round((widget.y - 32) / 372)) * size.h, ...size };
};
