import { createDatasetFromRows } from './datasetImport';
import type { Dataset } from './types';

export type ApiAuthType = 'none' | 'apiKey' | 'bearer' | 'basic';
export type ApiSourceConfig = {
  name: string;
  url: string;
  method: 'GET' | 'POST';
  authType: ApiAuthType;
  secret: string;
  headers: string;
  queryParams: string;
  body: string;
  dataPath: string;
  syncFrequency: 'manual' | '15m' | '1h' | '24h';
};

const parseObject = (value: string, label: string) => {
  if (!value.trim()) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return Object.fromEntries(Object.entries(parsed).map(([key, item]) => [key, String(item)]));
  } catch {
    throw new Error(`${label} doit être un objet JSON valide.`);
  }
};

const getByPath = (response: unknown, path: string): unknown => path.trim().split('.').filter(Boolean).reduce<unknown>((current, part) => (
  current && typeof current === 'object' ? (current as Record<string, unknown>)[part] : undefined
), response);

const findObjectArrays = (value: unknown, prefix = '', depth = 0): string[] => {
  if (depth > 4 || !value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.every((item) => item && typeof item === 'object' && !Array.isArray(item)) ? [prefix || 'racine'] : [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => findObjectArrays(item, prefix ? `${prefix}.${key}` : key, depth + 1));
};

const flattenRow = (value: Record<string, unknown>, prefix = ''): Record<string, string | number> => Object.entries(value).reduce<Record<string, string | number>>((row, [key, item]) => {
  const name = prefix ? `${prefix}.${key}` : key;
  if (item && typeof item === 'object' && !Array.isArray(item)) return { ...row, ...flattenRow(item as Record<string, unknown>, name) };
  row[name] = typeof item === 'number' ? item : item == null ? '' : Array.isArray(item) ? JSON.stringify(item) : String(item);
  return row;
}, {});

export const fetchApiDataset = async (config: ApiSourceConfig): Promise<Dataset> => {
  const url = new URL(config.url);
  Object.entries(parseObject(config.queryParams, 'Les paramètres')).forEach(([key, value]) => url.searchParams.set(key, value));
  const headers = parseObject(config.headers, 'Les headers');
  if (config.authType === 'apiKey' && config.secret) headers['X-API-Key'] = config.secret;
  if (config.authType === 'bearer' && config.secret) headers.Authorization = `Bearer ${config.secret}`;
  if (config.authType === 'basic' && config.secret) headers.Authorization = `Basic ${btoa(config.secret)}`;
  const init: RequestInit = { method: config.method, headers };
  if (config.method === 'POST' && config.body.trim()) {
    init.body = config.body;
    if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`L’API a répondu ${response.status}.`);
  const payload: unknown = await response.json();
  const candidates = findObjectArrays(payload);
  const rows = config.dataPath.trim()
    ? getByPath(payload, config.dataPath)
    : Array.isArray(payload) ? payload : candidates.length === 1 ? getByPath(payload, candidates[0]) : payload;
  if (!Array.isArray(rows) || !rows.every((row) => row && typeof row === 'object' && !Array.isArray(row))) {
    const suggestion = candidates.length ? ` Chemins détectés : ${candidates.join(', ')}.` : '';
    throw new Error(`Le chemin doit désigner un tableau d’objets.${suggestion}`);
  }
  const dataset = createDatasetFromRows(config.name.trim() || 'Source API', (rows as Record<string, unknown>[]).map((row) => flattenRow(row)));
  if (dataset.fields.length === 0) throw new Error('Aucune colonne exploitable n’a été détectée.');
  return dataset;
};
