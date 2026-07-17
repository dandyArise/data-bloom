import type { ReactElement } from 'react';

export type Aggregation = 'sum' | 'avg' | 'count' | 'min' | 'max';
export type WidgetSize = 'xs' | 'sm' | 'md' | 'lg';

export interface WidgetConfig {
  type: string;
  title: string;
  dimension?: string;
  measure?: string;
  aggregation?: Aggregation;
  limit?: number;
  sort?: { by: 'label' | 'value'; direction: 'asc' | 'desc' };
  size: WidgetSize;
  colorScheme?: (label: string, index: number) => string;
  legendPosition?: 'right' | 'bottom' | 'none';
  legendDetail?: 'label' | 'value' | 'percentage' | 'value_percentage';
  sliceLabel?: 'none' | 'label' | 'value' | 'percentage' | 'label_percentage';
}

export interface WidgetData {
  rows: Record<string, unknown>[];
  fields: { name: string; type: 'string' | 'number' | 'date' }[];
}

export interface WidgetProps {
  data: WidgetData;
  config: WidgetConfig;
}

export type WidgetRender = (data: WidgetData, config: WidgetConfig) => ReactElement;
