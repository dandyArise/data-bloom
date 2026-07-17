import type { Dataset } from './types';
import { isAggregatableMeasureField } from './dataProfiling';

export type DatasetDomain = 'generic' | 'finance' | 'monitoring' | 'logs' | 'iot' | 'crm' | 'hr' | 'geo' | 'survey';

export type DatasetShapeProfile = {
  rowCount: number;
  numericFieldCount: number;
  measureFieldCount: number;
  categoricalFieldCount: number;
  dateFieldCount: number;
  hasTimeSeries: boolean;
  hasMultipleMeasures: boolean;
  hasCoordinates: boolean;
  hasHierarchy: boolean;
  hasFreeText: boolean;
};

export type DatasetDomainProfile = {
  primaryDomain: DatasetDomain;
  rankedDomains: Array<{ domain: DatasetDomain; score: number }>;
  matchedSignals: string[];
  shape: DatasetShapeProfile;
};

type DomainRule = {
  domain: Exclude<DatasetDomain, 'generic'>;
  weight: number;
  patterns: RegExp[];
};

const domainRules: DomainRule[] = [
  { domain: 'finance', weight: 3, patterns: [/sales?/, /revenue/, /profit/, /margin/, /cogs?/, /discount/, /invoice/, /amount/, /turnover/, /chiffre.*affaire/] },
  { domain: 'monitoring', weight: 4, patterns: [/latency/, /latence/, /packet.*loss/, /perte.*paquet/, /uptime/, /probe/, /status.*code/, /response.*time/, /^ping$/, /^dns$/] },
  { domain: 'logs', weight: 3, patterns: [/(^|_)log/, /event/, /timestamp/, /severity/, /^level$/, /message/, /stack.*trace/, /error/, /warning/, /debug/] },
  { domain: 'iot', weight: 4, patterns: [/sensor/, /capteur/, /device/, /telemetry/, /temperature/, /humidity/, /pressure/, /voltage/, /current/, /reading/] },
  { domain: 'crm', weight: 3, patterns: [/ticket/, /opportunit/, /pipeline/, /deal/, /lead/, /customer/, /client/, /account/, /stage/, /case.*status/, /support/] },
  { domain: 'hr', weight: 3, patterns: [/employee/, /employe/, /manager/, /department/, /departement/, /headcount/, /tenure/, /anciennete/, /salary/, /salaire/, /job.*title/, /reports.*to/] },
  { domain: 'geo', weight: 3, patterns: [/latitude/, /longitude/, /^lat$/, /^lng$/, /^lon$/, /country/, /pays/, /region/, /city/, /ville/, /postal/, /geohash/, /address/] },
  { domain: 'survey', weight: 3, patterns: [/survey/, /question/, /response/, /reponse/, /rating/, /note/, /feedback/, /comment/, /verbatim/, /nps/, /csat/, /satisfaction/] },
];

const dateNamePattern = /date|time|timestamp|checked.*at|created.*at|updated.*at|month|year|week|jour|heure/i;
const coordinatePattern = /latitude|longitude|^lat$|^lng$|^lon$|geohash/i;
const hierarchyPattern = /manager|parent|reports.*to|supervisor|n\+1|responsable/i;
const freeTextPattern = /message|description|comment|feedback|verbatim|response|reponse|summary|details?/i;
const allDomains: DatasetDomain[] = ['generic', 'finance', 'monitoring', 'logs', 'iot', 'crm', 'hr', 'geo', 'survey'];

export function profileDatasetDomain(dataset: Dataset): DatasetDomainProfile {
  const scores = new Map<DatasetDomain, number>(allDomains.map((domain) => [domain, domain === 'generic' ? 1 : 0]));
  const matchedSignals = new Set<string>();
  let numericFieldCount = 0;
  let measureFieldCount = 0;
  let categoricalFieldCount = 0;
  let dateFieldCount = 0;
  let hasCoordinates = false;
  let hasHierarchy = false;
  let hasFreeText = false;

  for (const field of dataset.fields) {
    const isCoordinate = coordinatePattern.test(field.name);
    if (field.type === 'number') {
      numericFieldCount += 1;
      if (!isCoordinate && isAggregatableMeasureField(field)) measureFieldCount += 1;
    }
    if (field.type === 'string') categoricalFieldCount += 1;
    if (field.type === 'date' || dateNamePattern.test(field.name)) dateFieldCount += 1;
    if (isCoordinate) hasCoordinates = true;
    if (hierarchyPattern.test(field.name)) hasHierarchy = true;
    if (field.type === 'string' && freeTextPattern.test(field.name)) hasFreeText = true;

    const normalizedName = field.name.toLowerCase();
    for (const rule of domainRules) {
      if (!rule.patterns.some((pattern) => pattern.test(normalizedName))) continue;
      scores.set(rule.domain, (scores.get(rule.domain) ?? 0) + rule.weight);
      matchedSignals.add(field.name);
    }
  }

  if (dataset.source?.type === 'monitor') {
    scores.set('monitoring', (scores.get('monitoring') ?? 0) + 12);
    matchedSignals.add(`source:${dataset.source.probeType}`);
  }

  const rankedDomains = allDomains
    .map((domain) => ({ domain, score: scores.get(domain) ?? 0 }))
    .sort((left, right) => right.score - left.score || left.domain.localeCompare(right.domain));
  const primaryDomain = rankedDomains[0]?.score > 1 ? rankedDomains[0].domain : 'generic';

  return {
    primaryDomain,
    rankedDomains: rankedDomains.filter((entry) => entry.score > 0),
    matchedSignals: [...matchedSignals],
    shape: {
      rowCount: dataset.rows.length,
      numericFieldCount,
      measureFieldCount,
      categoricalFieldCount,
      dateFieldCount,
      hasTimeSeries: dateFieldCount > 0,
      hasMultipleMeasures: measureFieldCount > 1,
      hasCoordinates,
      hasHierarchy,
      hasFreeText,
    },
  };
}
