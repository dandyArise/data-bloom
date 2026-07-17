import type { Dataset, DatasetField } from './types';
import { isDateLike, profileDataset, type ProfiledField } from './dataProfiling';

export type DataQualitySeverity = 'error' | 'warning' | 'info';

export type DataQualityIssue = {
  id: string;
  severity: DataQualitySeverity;
  title: string;
  detail: string;
};

export type FieldQualityProfile = {
  name: string;
  type: DatasetField['type'];
  filledCount: number;
  missingCount: number;
  distinctCount: number;
  sampleValues: string[];
  profile: ProfiledField;
};

export type DataQualityReport = {
  score: number;
  rowCount: number;
  fieldCount: number;
  emptyRowCount: number;
  duplicateRowCount: number;
  invalidColumnCount: number;
  ambiguousDateCount: number;
  missingValueCount: number;
  issues: DataQualityIssue[];
  fields: FieldQualityProfile[];
  previewRows: Record<string, string | number>[];
};

const invalidColumnPattern = /^(column\s*\d+)?$/i;
const ambiguousDatePattern = /^(0?[1-9]|[12]\d|3[01])[/-](0?[1-9]|1[0-2])[/-](\d{2}|\d{4})$/;

const isBlank = (value: unknown) => value == null || String(value).trim() === '';

const normalizeRow = (row: Record<string, string | number>) => JSON.stringify(
  Object.keys(row)
    .sort()
    .map((key) => [key, isBlank(row[key]) ? '' : String(row[key]).trim().toLowerCase()]),
);

export const removeDuplicateDatasetRows = (dataset: Dataset) => {
  const seenRows = new Set<string>();
  return dataset.rows.filter((row) => {
    const rowKey = normalizeRow(row);
    if (seenRows.has(rowKey)) return false;
    seenRows.add(rowKey);
    return true;
  });
};

const createIssue = (id: string, severity: DataQualitySeverity, title: string, detail: string): DataQualityIssue => ({
  id,
  severity,
  title,
  detail,
});

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export const analyzeDatasetQuality = (dataset: Dataset): DataQualityReport => {
  const issues: DataQualityIssue[] = [];
  const fields = dataset.fields;
  const rows = dataset.rows;
  const seenRows = new Set<string>();
  let emptyRowCount = 0;
  let duplicateRowCount = 0;
  let missingValueCount = 0;
  let ambiguousDateCount = 0;

  const columnNames = fields.map((field) => field.name.trim());
  const duplicateColumnNames = new Set(columnNames.filter((name, index) => columnNames.indexOf(name) !== index));
  const invalidColumnCount = fields.filter((field) => invalidColumnPattern.test(field.name.trim()) || field.name.includes('\uFFFD')).length;

  rows.forEach((row) => {
    const values = fields.map((field) => row[field.name]);
    const isEmptyRow = values.every(isBlank);
    if (isEmptyRow) {
      emptyRowCount += 1;
      return;
    }

    const rowKey = normalizeRow(row);
    if (seenRows.has(rowKey)) {
      duplicateRowCount += 1;
    } else {
      seenRows.add(rowKey);
    }

    fields.forEach((field) => {
      const value = row[field.name];
      if (isBlank(value)) {
        missingValueCount += 1;
      }

      if (field.type === 'date' && typeof value === 'string' && ambiguousDatePattern.test(value)) {
        ambiguousDateCount += 1;
      }
    });
  });

  const genericProfiles = profileDataset(dataset);
  const fieldProfiles: FieldQualityProfile[] = fields.map((field) => {
    const values = rows.map((row) => row[field.name]);
    const filledValues = values.filter((value) => !isBlank(value));
    const stringValues = filledValues.map(String);

    return {
      name: field.name,
      type: field.type,
      filledCount: filledValues.length,
      missingCount: rows.length - filledValues.length,
      distinctCount: new Set(stringValues).size,
      sampleValues: [...new Set(stringValues)].slice(0, 3),
      profile: genericProfiles.find((profile) => profile.name === field.name)!,
    };
  });

  if (fields.length === 0) {
    issues.push(createIssue('no-fields', 'error', 'Aucune colonne détectée', 'Importe un fichier avec une ligne d’en-tête exploitable.'));
  }

  if (rows.length === 0) {
    issues.push(createIssue('no-rows', 'warning', 'Aucune ligne de données', 'Le dataset contient des colonnes mais aucune ligne exploitable.'));
  }

  if (invalidColumnCount > 0) {
    issues.push(createIssue('invalid-columns', 'warning', 'Colonnes suspectes', `${invalidColumnCount} colonne(s) ont un nom vide, générique ou corrompu.`));
  }

  if (duplicateColumnNames.size > 0) {
    issues.push(createIssue('duplicate-columns', 'warning', 'Noms de colonnes dupliqués', `${duplicateColumnNames.size} nom(s) de colonnes apparaissent plusieurs fois.`));
  }

  if (emptyRowCount > 0) {
    issues.push(createIssue('empty-rows', 'info', 'Lignes vides', `${emptyRowCount} ligne(s) sont entièrement vides.`));
  }

  if (duplicateRowCount > 0) {
    issues.push(createIssue('duplicate-rows', 'warning', 'Lignes dupliquées', `${duplicateRowCount} doublon(s) de lignes détectés.`));
  }

  if (missingValueCount > 0) {
    issues.push(createIssue('missing-values', 'info', 'Valeurs manquantes', `${missingValueCount} cellule(s) sont vides.`));
  }

  for (const profile of genericProfiles) {
    if (profile.kind === 'excluded' || profile.kind === 'anomaly') {
      issues.push(createIssue(`profile-${profile.name}`, profile.kind === 'anomaly' ? 'warning' : 'info', profile.name, profile.reason));
    }
  }

  if (ambiguousDateCount > 0) {
    issues.push(createIssue('ambiguous-dates', 'warning', 'Dates ambiguës', `${ambiguousDateCount} date(s) utilisent un format jour/mois difficile à confirmer automatiquement.`));
  }

  // Les pénalités doivent refléter une proportion de données concernées, jamais
  // le volume brut : un fichier de plusieurs milliers de lignes ne doit pas
  // tomber mécaniquement à 0/100 parce qu'il contient quelques cellules vides.
  const nonEmptyRowCount = Math.max(0, rows.length - emptyRowCount);
  const cellCount = Math.max(1, rows.length * Math.max(1, fields.length));
  const score = fields.length === 0 || rows.length === 0 ? 0 : clampScore(
    100
    - invalidColumnCount * 12
    - duplicateColumnNames.size * 10
    - (duplicateRowCount / Math.max(1, nonEmptyRowCount)) * 28
    - (emptyRowCount / Math.max(1, rows.length)) * 15
    - (missingValueCount / cellCount) * 32
    - (ambiguousDateCount / Math.max(1, rows.length)) * 15,
  );

  return {
    score,
    rowCount: rows.length,
    fieldCount: fields.length,
    emptyRowCount,
    duplicateRowCount,
    invalidColumnCount,
    ambiguousDateCount,
    missingValueCount,
    issues,
    fields: fieldProfiles,
    previewRows: rows.slice(0, 5),
  };
};
