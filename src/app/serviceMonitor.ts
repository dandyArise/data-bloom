import { createDatasetFromRows } from './datasetImport';
import type { Dataset, MonitorDatasetSource, SyncFrequency } from './types';

export type MonitorSourceConfig = {
  name: string;
  url: string;
  probeType: 'http' | 'dns' | 'ping';
  syncFrequency: SyncFrequency;
};

type ServiceHealthEvent = {
  checkedAt: string;
  probeType: 'http' | 'dns' | 'ping';
  status: 'up' | 'degraded' | 'down';
  latencyMs: number;
  statusCode: number | '';
  message: string;
};

const toSource = (config: MonitorSourceConfig, event: ServiceHealthEvent): MonitorDatasetSource => ({
  type: 'monitor',
  url: config.url,
  probeType: config.probeType,
  syncFrequency: config.syncFrequency,
  lastCheckedAt: event.checkedAt,
  lastStatus: event.status,
  lastLatencyMs: event.latencyMs,
  lastMessage: event.message,
});

export const probeService = async (url: string, probeType: MonitorSourceConfig['probeType']): Promise<ServiceHealthEvent> => {
  const startedAt = performance.now();
  const checkedAt = new Date().toISOString();

  try {
    const response = probeType === 'http'
      ? await fetch(url, { method: 'GET', cache: 'no-store' })
      : await fetch(`/monitor/probe?type=${probeType}&target=${encodeURIComponent(url)}`, { cache: 'no-store' });
    const latencyMs = Math.round(performance.now() - startedAt);
    const payload = probeType === 'http' ? null : await response.json() as { status: ServiceHealthEvent['status']; latencyMs?: number; message: string; statusCode?: number | '' };
    if (payload) return { checkedAt, probeType, status: payload.status, latencyMs: payload.latencyMs ?? latencyMs, statusCode: payload.statusCode ?? '', message: payload.message };
    const status = response.ok ? 'up' : response.status < 500 ? 'degraded' : 'down';
    return {
      checkedAt,
      probeType,
      status,
      latencyMs,
      statusCode: response.status,
      message: response.ok ? 'Disponible' : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      checkedAt,
      probeType,
      status: 'down',
      latencyMs: Math.round(performance.now() - startedAt),
      statusCode: '',
      message: error instanceof Error ? error.message : 'Connexion impossible',
    };
  }
};

export const createMonitorDataset = async (config: MonitorSourceConfig): Promise<Dataset> => {
  const event = await probeService(config.url, config.probeType);
  const dataset = createDatasetFromRows(config.name.trim() || 'Supervision applicative', [event]);
  return { ...dataset, source: toSource(config, event) };
};

export const appendMonitorEvent = async (dataset: Dataset): Promise<Dataset> => {
  if (dataset.source?.type !== 'monitor') return dataset;
  const event = await probeService(dataset.source.url, dataset.source.probeType);
  return {
    ...dataset,
    rows: [...dataset.rows, event],
    source: toSource({ name: dataset.name, url: dataset.source.url, probeType: dataset.source.probeType, syncFrequency: dataset.source.syncFrequency }, event),
  };
};
