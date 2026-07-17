import type { Dataset, DatasetField } from './types';

export type ProfiledFieldKind = 'measure' | 'temporal' | 'dimension' | 'identifier' | 'text' | 'excluded' | 'anomaly';

export type ProfiledField = {
  name: string;
  declaredType: DatasetField['type'];
  inferredType: DatasetField['type'] | 'mixed';
  kind: ProfiledFieldKind;
  filledCount: number;
  fillRate: number;
  distinctCount: number;
  distinctRate: number;
  numericMatchRate: number;
  dateMatchRate: number;
  eligibleForWidgets: boolean;
  reason: string;
  sampleValues: string[];
};

const blank = (value: unknown) => value == null || String(value).trim() === '';
const monthDatePattern = /^\d{1,2}\s+[a-z]{3,9}\s+\d{2,4}$/i;
const datePattern = /^(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4})$/;

const normalizeFieldName = (name: string) => name
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const numericTemporalNames = new Set([
  'year', 'annee', 'fiscal year', 'calendar year',
  'month', 'mois', 'month number', 'month no', 'month num', 'numero mois',
  'quarter', 'trimestre', 'quarter number', 'numero trimestre',
  'week', 'semaine', 'week number', 'numero semaine',
  'day', 'jour', 'day number', 'numero jour',
  'hour', 'heure', 'hour number', 'numero heure',
]);

export const getNumericDimensionKind = (name: string): 'temporal' | 'identifier' | null => {
  const normalized = normalizeFieldName(name);
  if (numericTemporalNames.has(normalized)) return 'temporal';
  if (/(^| )(id|identifier|identifiant|code|key|cle|number|numero|num|no)$/.test(normalized)) return 'identifier';
  return null;
};

export const isAggregatableMeasureField = (field: DatasetField) =>
  field.type === 'number' && getNumericDimensionKind(field.name) === null;

export const parseProfileNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  let source = value.trim();
  if (!source || datePattern.test(source)) return null;
  const negative = /^\(.*\)$/.test(source);
  source = source.replace(/^\(|\)$/g, '').replace(/[€$£¥%]/g, '').replace(/\s/g, '');
  if (!source) return null;
  const comma = source.lastIndexOf(',');
  const dot = source.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) {
    source = comma > dot ? source.replace(/\./g, '').replace(',', '.') : source.replace(/,/g, '');
  } else if (comma >= 0) {
    source = /^-?\d{1,3}(,\d{3})+$/.test(source) ? source.replace(/,/g, '') : source.replace(',', '.');
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(source)) {
    source = source.replace(/\./g, '');
  }
  const parsed = Number(source);
  return Number.isFinite(parsed) ? (negative ? -parsed : parsed) : null;
};

export const isDateLike = (value: unknown) => typeof value === 'string' && (datePattern.test(value.trim()) || monthDatePattern.test(value.trim()));

export const profileDataset = (dataset: Dataset): ProfiledField[] => dataset.fields.map((field) => {
  const values = dataset.rows.map((row) => row[field.name]);
  const filled = values.filter((value) => !blank(value));
  const filledCount = filled.length;
  const fillRate = dataset.rows.length ? filledCount / dataset.rows.length : 0;
  const distinctCount = new Set(filled.map((value) => String(value).trim().toLowerCase())).size;
  const distinctRate = filledCount ? distinctCount / filledCount : 0;
  const numericMatchRate = filledCount ? filled.filter((value) => parseProfileNumber(value) !== null).length / filledCount : 0;
  const dateMatchRate = filledCount ? filled.filter(isDateLike).length / filledCount : 0;
  const sampleValues = [...new Set(filled.map(String))].slice(0, 5);
  let inferredType: ProfiledField['inferredType'] = field.type;
  let kind: ProfiledFieldKind = 'text';
  let eligibleForWidgets = false;
  let reason = 'Texte libre ou cardinalité trop élevée pour une proposition automatique.';

  if (fillRate < 0.05) {
    kind = 'excluded';
    reason = `Exclue : seulement ${Math.round(fillRate * 100)} % de valeurs renseignées.`;
  } else if ((numericMatchRate >= 0.1 && numericMatchRate < 0.9) || (dateMatchRate >= 0.1 && dateMatchRate < 0.9)) {
    inferredType = 'mixed';
    kind = 'anomaly';
    reason = 'Format incohérent : le type détecté ne couvre qu’une partie des valeurs.';
  } else if (numericMatchRate >= 0.9 && getNumericDimensionKind(field.name) === 'temporal') {
    inferredType = 'number';
    kind = 'temporal';
    eligibleForWidgets = true;
    reason = 'Clé temporelle numérique utilisable comme axe, mais jamais comme mesure à sommer.';
  } else if (numericMatchRate >= 0.9 && getNumericDimensionKind(field.name) === 'identifier') {
    inferredType = 'number';
    kind = 'identifier';
    reason = 'Identifiant numérique exclu des mesures : sa somme n’a aucun sens statistique.';
  } else if (numericMatchRate >= 0.9) {
    inferredType = 'number';
    kind = 'measure';
    eligibleForWidgets = true;
    reason = field.type === 'number' ? 'Mesure numérique.' : 'Texte reparsable comme mesure numérique.';
  } else if (dateMatchRate >= 0.9) {
    inferredType = 'date';
    kind = 'temporal';
    eligibleForWidgets = true;
    reason = field.type === 'date' ? 'Dimension temporelle.' : 'Texte reparsable comme date.';
  } else if (distinctCount < 50 || distinctRate < 0.2) {
    kind = 'dimension';
    eligibleForWidgets = true;
    reason = 'Dimension catégorielle utilisable comme axe.';
  } else if (distinctRate >= 0.8) {
    kind = 'identifier';
    reason = 'Exclue des widgets automatiques : cardinalité proche du nombre de lignes.';
  }

  if (fillRate >= 0.05 && fillRate < 0.3) reason += ' Fiabilité limitée : moins de 30 % des valeurs sont renseignées.';
  return { name: field.name, declaredType: field.type, inferredType, kind, filledCount, fillRate, distinctCount, distinctRate, numericMatchRate, dateMatchRate, eligibleForWidgets, reason, sampleValues };
});
