import type { Dataset, DatasetField } from './types';
import { parseProfileNumber } from './dataProfiling';

type CellValue = string | number | Date | null | undefined;
export type RawRow = Record<string, CellValue>;

const dateLikePattern = /^(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})$/;

const createUniqueColumns = (headers: string[]) => {
  const seen = new Map<string, number>();

  return headers.map((header, index) => {
    const base = header.trim() || `Column ${index + 1}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base} ${count + 1}`;
  });
};

const parseNumber = parseProfileNumber;

const parseDate = (value: unknown) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!dateLikePattern.test(trimmed)) {
    return null;
  }

  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }

  const parts = trimmed.split(/[/-]/).map(Number);
  if (parts.length !== 3) {
    return null;
  }

  const [first, second, rawYear] = parts;
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;
  const day = first > 12 ? first : second > 12 ? second : first;
  const month = first > 12 ? second : second > 12 ? first : second;
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
};

const inferField = (name: string, values: CellValue[]): DatasetField => {
  const filled = values.filter((value) => value !== '' && value != null);
  if (filled.length === 0) {
    return { name, type: 'string' };
  }

  const dateCount = filled.filter((value) => parseDate(value) !== null).length;
  if (dateCount / filled.length >= 0.9) {
    return { name, type: 'date' };
  }

  const numberCount = filled.filter((value) => parseNumber(value) !== null).length;
  if (numberCount / filled.length >= 0.9) {
    return { name, type: 'number' };
  }

  return { name, type: 'string' };
};

const normalizeValue = (value: CellValue, type: DatasetField['type']) => {
  if (value == null) {
    return '';
  }

  if (type === 'number') {
    return parseNumber(value) ?? '';
  }

  if (type === 'date') {
    return parseDate(value) ?? String(value);
  }

  return String(value).trim();
};

export const createDatasetFromRows = (name: string, rawRows: RawRow[]): Dataset => {
  const nonEmptyRows = rawRows.filter((row) => Object.values(row).some((value) => value !== '' && value != null));
  const columns = createUniqueColumns([...new Set(nonEmptyRows.flatMap((row) => Object.keys(row)))]);
  const fields = columns.map((column) => inferField(column, nonEmptyRows.map((row) => row[column])));
  const rows = nonEmptyRows.map((row) => Object.fromEntries(fields.map((field) => [field.name, normalizeValue(row[field.name], field.type)])));

  return {
    id: crypto.randomUUID(),
    name,
    fields,
    rows,
  };
};

const scoreDelimiter = (line: string, delimiter: string) => parseDelimitedRows(line, delimiter)[0]?.length ?? 0;

const detectDelimiter = (headerLine: string) => {
  const candidates = [',', ';', '\t'];
  return [...candidates].sort((left, right) => scoreDelimiter(headerLine, right) - scoreDelimiter(headerLine, left))[0];
};

function parseDelimitedRows(text: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      row.push(cell.trim());
      cell = '';
      continue;
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') {
        index += 1;
      }
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  row.push(cell.trim());
  rows.push(row);
  return rows.filter((item) => item.some((value) => value !== ''));
}

export const parseDelimitedDataset = (fileName: string, text: string): Dataset[] => {
  const cleanText = text.replace(/^\uFEFF/, '').trim();
  if (!cleanText) {
    throw new Error('Le fichier est vide.');
  }

  const firstLine = cleanText.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = detectDelimiter(firstLine);
  const [headers, ...dataRows] = parseDelimitedRows(cleanText, delimiter);
  const columns = createUniqueColumns(headers);
  const rows = dataRows.map((values) => Object.fromEntries(columns.map((column, index) => [column, values[index] ?? ''])));
  const dataset = createDatasetFromRows(fileName.replace(/\.[^.]+$/, ''), rows);
  return dataset.fields.length > 0 ? [dataset] : [];
};

export const parseExcelDatasets = async (fileName: string, buffer: ArrayBuffer): Promise<Dataset[]> => {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const baseName = fileName.replace(/\.[^.]+$/, '');

  const datasets: Dataset[] = [];
  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<RawRow>(workbook.Sheets[sheetName], { defval: '', raw: true });
    const dataset = createDatasetFromRows(`${baseName} - ${sheetName}`, rows);
    if (dataset.fields.length > 0) datasets.push(dataset);
  }
  return datasets;
};

const isZipBasedExcel = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer.slice(0, 4));
  return bytes[0] === 0x50 && bytes[1] === 0x4b;
};

const looksLikeBinary = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer.slice(0, 2048));
  if (bytes.length === 0) {
    return false;
  }

  const suspicious = bytes.filter((byte) => byte === 0 || byte < 7 || (byte > 14 && byte < 32)).length;
  return suspicious / bytes.length > 0.05;
};

export const importDatasetsFromFile = async (file: File): Promise<Dataset[]> => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const buffer = await file.arrayBuffer();
  const isExcelExtension = extension === 'xlsx' || extension === 'xls' || extension === 'xlsm' || extension === 'xlsb';

  if (isExcelExtension || isZipBasedExcel(buffer)) {
    return parseExcelDatasets(file.name, buffer);
  }

  if (extension === 'csv' || extension === 'tsv' || file.type.includes('csv') || file.type.includes('tab-separated-values')) {
    if (looksLikeBinary(buffer)) {
      throw new Error('Ce fichier ressemble a un binaire. Renomme-le en .xlsx/.xlsm si c est un Excel, ou exporte-le en CSV.');
    }

    return parseDelimitedDataset(file.name, new TextDecoder().decode(buffer));
  }

  throw new Error('Format non supporte. Importe un fichier CSV, TSV, XLS, XLSX, XLSM ou XLSB.');
};
