import { widgetRegistry as bloomWidgetRegistry } from '@bloom/index';
import { profileDatasetDomain, type DatasetDomain, type DatasetDomainProfile } from './datasetDomain';
import type { Dataset, WidgetType } from './types';

export type WidgetRegistryEntry = {
  type: WidgetType;
  label: string;
  requiresData: boolean;
  defaultSize: { w: number; h: number };
  detectRelevance: (profile: DatasetDomainProfile) => number;
};

export type WidgetRecommendation = {
  type: WidgetType;
  label: string;
  score: number;
};

const domainScore = (profile: DatasetDomainProfile, domain: DatasetDomain) =>
  profile.rankedDomains.find((entry) => entry.domain === domain)?.score ?? 0;

const registryEntries: WidgetRegistryEntry[] = [
  {
    type: 'kpi', label: 'KPI', requiresData: true, defaultSize: { w: 3, h: 3 },
    detectRelevance: ({ shape }) => shape.measureFieldCount > 0 ? 55 : shape.hasCoordinates ? 0 : 15,
  },
  {
    type: 'comparison', label: 'Comparaison', requiresData: true, defaultSize: { w: 4, h: 3 },
    detectRelevance: ({ shape }) => shape.measureFieldCount > 0 && shape.hasTimeSeries ? 70 : 0,
  },
  {
    type: 'kpi-group', label: 'Groupe KPI', requiresData: true, defaultSize: { w: 8, h: 3 },
    detectRelevance: ({ shape }) => shape.hasMultipleMeasures ? 62 : 0,
  },
  {
    type: 'bar', label: 'Bar', requiresData: true, defaultSize: { w: 6, h: 4 },
    detectRelevance: ({ shape }) => shape.categoricalFieldCount > 0 ? 50 : 20,
  },
  {
    type: 'line', label: 'Line', requiresData: true, defaultSize: { w: 6, h: 4 },
    detectRelevance: (profile) => profile.shape.hasTimeSeries && profile.shape.measureFieldCount > 0
      ? 58 + Math.min(domainScore(profile, 'iot') + domainScore(profile, 'logs'), 18)
      : 0,
  },
  {
    type: 'pie', label: 'Pie', requiresData: true, defaultSize: { w: 4, h: 4 },
    detectRelevance: ({ shape }) => shape.categoricalFieldCount > 0 ? 32 : 0,
  },
  {
    type: 'heatmap', label: 'Heatmap', requiresData: true, defaultSize: { w: 8, h: 6 },
    detectRelevance: (profile) => {
      const dimensionCount = profile.shape.categoricalFieldCount + profile.shape.dateFieldCount;
      if (dimensionCount >= 2 && profile.shape.measureFieldCount > 0) {
        return 54 + Math.min(domainScore(profile, 'iot') + domainScore(profile, 'logs'), 20);
      }
      return profile.shape.hasTimeSeries && profile.shape.numericFieldCount > 1 ? 46 : 0;
    },
  },
  { type: 'table', label: 'Table', requiresData: true, defaultSize: { w: 8, h: 4 }, detectRelevance: () => 28 },
  {
    type: 'text', label: 'Insight', requiresData: false, defaultSize: { w: 4, h: 3 },
    detectRelevance: ({ shape }) => shape.hasFreeText ? 35 : 12,
  },
  { type: 'note', label: 'Note', requiresData: false, defaultSize: { w: 4, h: 2 }, detectRelevance: () => 6 },
  {
    type: 'service-status', label: 'Statut service', requiresData: true, defaultSize: { w: 5, h: 3 },
    detectRelevance: (profile) => domainScore(profile, 'monitoring') > 0 ? 82 + domainScore(profile, 'monitoring') : 0,
  },
  {
    type: 'threshold-line', label: 'Latence + seuils', requiresData: true, defaultSize: { w: 7, h: 4 },
    detectRelevance: (profile) => profile.shape.hasTimeSeries && domainScore(profile, 'monitoring') > 0
      ? 88 + domainScore(profile, 'monitoring')
      : 0,
  },
  {
    type: 'radial-gauge', label: 'Jauge', requiresData: true, defaultSize: { w: 5, h: 4 },
    detectRelevance: (profile) => profile.shape.measureFieldCount > 0
      && (domainScore(profile, 'monitoring') > 0 || domainScore(profile, 'iot') > 0)
      ? 72 + Math.max(domainScore(profile, 'monitoring'), domainScore(profile, 'iot'))
      : 0,
  },
  {
    type: 'availability-grid', label: 'Disponibilité', requiresData: true, defaultSize: { w: 7, h: 4 },
    detectRelevance: (profile) => profile.shape.hasTimeSeries && domainScore(profile, 'monitoring') > 0
      ? 78 + domainScore(profile, 'monitoring')
      : 0,
  },
];

export const widgetRegistry = new Map<WidgetType, WidgetRegistryEntry>();
for (const entry of registryEntries) {
  if (!bloomWidgetRegistry.has(entry.type)) throw new Error(`Renderer Bloom manquant : ${entry.type}`);
  if (widgetRegistry.has(entry.type)) throw new Error(`Widget déjà enregistré : ${entry.type}`);
  widgetRegistry.set(entry.type, entry);
}

export function getWidgetDefinition(type: string) {
  return widgetRegistry.get(type as WidgetType);
}

export function getWidgetRecommendations(dataset: Dataset, limit = 8) {
  const profile = profileDatasetDomain(dataset);
  const recommendations: WidgetRecommendation[] = [];
  for (const entry of widgetRegistry.values()) {
    const score = entry.detectRelevance(profile);
    if (score > 0) recommendations.push({ type: entry.type, label: entry.label, score });
  }
  recommendations.sort((left, right) => right.score - left.score || left.label.localeCompare(right.label, 'fr'));
  return { profile, recommendations: recommendations.slice(0, Math.max(1, limit)) };
}
