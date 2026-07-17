import { useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import { Activity, CheckCircle2, ChevronDown, Database, EyeOff, FileUp, KeyRound, LoaderCircle, Pencil, Plus, Table2, Trash2, Upload, X } from 'lucide-react';
import { fetchApiDataset, type ApiSourceConfig } from '../apiSource';
import { analyzeDatasetQuality } from '../dataQuality';
import { createMonitorDataset, type MonitorSourceConfig } from '../serviceMonitor';
import type { Dataset } from '../types';

type DatasetPanelProps = {
  dataset: Dataset;
  datasets: Dataset[];
  isDatasetOpen: boolean;
  isImporting: boolean;
  importError: string;
  onToggleDataset: () => void;
  onSelectDataset: (id: string) => void;
  onRenameDataset: (id: string, name: string) => void;
  onDeleteDataset: (id: string) => void;
  onImportDataset: (file: File) => Promise<void>;
  onOpenGrid: () => void;
  onReviewQualityIssue: (issue: 'duplicates' | 'missing') => void;
  onRemoveDuplicateRows: () => void;
  onConnectApi: (dataset: Dataset, source: Pick<ApiSourceConfig, 'url' | 'syncFrequency'>) => void;
  onConnectMonitor: (dataset: Dataset) => void;
  onCheckMonitor: (datasetId: string) => Promise<void>;
};

export function DatasetPanel({
  dataset,
  datasets,
  isDatasetOpen,
  isImporting,
  importError,
  onToggleDataset,
  onSelectDataset,
  onRenameDataset,
  onDeleteDataset,
  onImportDataset,
  onOpenGrid,
  onReviewQualityIssue,
  onRemoveDuplicateRows,
  onConnectApi,
  onConnectMonitor,
  onCheckMonitor,
}: DatasetPanelProps) {
  const importInputRef = useRef<HTMLInputElement>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [areFieldsOpen, setAreFieldsOpen] = useState(false);
  const [sourceType, setSourceType] = useState<'file' | 'api' | 'monitor' | null>(null);
  const [isSourceDialogOpen, setIsSourceDialogOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState(dataset.name);
  const qualityReport = useMemo(() => analyzeDatasetQuality(dataset), [dataset]);

  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void onImportDataset(file).then(() => setIsSourceDialogOpen(false));
    event.target.value = '';
  };

  const commitRename = () => {
    const nextName = draftName.trim();
    if (dataset.id && nextName) onRenameDataset(dataset.id, nextName);
    setIsRenaming(false);
  };

  return (
    <>
      <div className="dataset-source-actions">
        <button className="primary-button" type="button" onClick={() => { setSourceType(null); setIsSourceDialogOpen(true); }}><Plus size={18} />Ajouter une source</button>
      </div>
      <section className="dataset-identity-card" aria-label="Dataset actif">
        <Database size={24} />
        <div className="dataset-identity-copy">
          {isRenaming ? <input aria-label="Nom du dataset" autoFocus value={draftName} onChange={(event) => setDraftName(event.target.value)} onBlur={commitRename} onKeyDown={(event) => { if (event.key === 'Enter') commitRename(); if (event.key === 'Escape') setIsRenaming(false); }} /> : <strong>{dataset.name}</strong>}
          <span>{dataset.fields.length === 0 ? 'Importe un dataset pour commencer' : dataset.source?.type === 'monitor' ? `${dataset.rows.length} événements · ${dataset.source.lastStatus === 'up' ? 'Disponible' : dataset.source.lastStatus === 'degraded' ? 'Dégradée' : 'Indisponible'}` : `${dataset.fields.length} colonnes · ${dataset.rows.length} lignes · ${dataset.source?.type === 'api' ? 'API' : 'Fichier'}`}</span>
        </div>
        {dataset.id && <button className="ghost-button icon-only dataset-rename-button" type="button" title="Renommer le dataset" aria-label="Renommer le dataset" onClick={() => { setDraftName(dataset.name); setIsRenaming(true); }}><Pencil size={18} /></button>}
        {datasets.length > 1 && <label className="dataset-switcher"><span>Changer de dataset</span><select value={dataset.id} onChange={(event) => onSelectDataset(event.target.value)}>{datasets.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      </section>
      <div className="dataset-content">
          {dataset.source?.type === 'monitor' && (
            <section className={`monitor-status ${dataset.source.lastStatus}`} aria-label="État du service surveillé">
              <div><Activity size={18} /><span><strong>{dataset.source.lastStatus === 'up' ? 'Application disponible' : dataset.source.lastStatus === 'degraded' ? 'Application dégradée' : 'Application indisponible'}</strong><small>Dernier contrôle : {new Date(dataset.source.lastCheckedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}{dataset.source.lastLatencyMs !== undefined ? ` · ${dataset.source.lastLatencyMs} ms` : ''}</small></span></div>
              <button className="ghost-button" type="button" onClick={() => void onCheckMonitor(dataset.id)}>Vérifier maintenant</button>
            </section>
          )}
          {isConfirmingDelete && dataset.id && (
            <div className="confirm-delete-row">
              <span>Supprimer ce dataset ?</span>
              <button className="danger-button" type="button" onClick={() => { onDeleteDataset(dataset.id); setIsConfirmingDelete(false); }}>
                Supprimer
              </button>
              <button className="ghost-button" type="button" onClick={() => setIsConfirmingDelete(false)}>
                Annuler
              </button>
            </div>
          )}
          {dataset.id && (
            <section className="data-quality-panel" aria-label="Qualité du dataset">
              <div className="data-quality-header">
                <div>
                  <strong>Qualité des données</strong>
                  <span>Doublons, valeurs manquantes et formats détectés.</span>
                </div>
                <div className={qualityReport.score >= 80 ? 'quality-score good' : qualityReport.score >= 55 ? 'quality-score medium' : 'quality-score bad'} style={{ '--score': `${qualityReport.score * 3.6}deg` } as CSSProperties}><strong>{qualityReport.score}</strong><span>/100</span></div>
              </div>
              <div className="quality-metrics">
                <div className={qualityReport.duplicateRowCount > 0 ? 'quality-metric warning' : 'quality-metric good'}><strong>{qualityReport.duplicateRowCount}</strong><span>lignes dupliquées</span></div>
                <div className={qualityReport.missingValueCount > 0 ? 'quality-metric warning' : 'quality-metric good'}><strong>{qualityReport.missingValueCount}</strong><span>valeurs manquantes</span></div>
                <div className={qualityReport.emptyRowCount > 0 ? 'quality-metric warning' : 'quality-metric good'}><strong>{qualityReport.emptyRowCount}</strong><span>lignes entièrement vides</span></div>
                <div className={qualityReport.ambiguousDateCount > 0 ? 'quality-metric warning' : 'quality-metric good'}><strong>{qualityReport.ambiguousDateCount}</strong><span>dates ambiguës</span></div>
              </div>
              {(qualityReport.duplicateRowCount > 0 || qualityReport.missingValueCount > 0) ? <div className="quality-actions">
                {qualityReport.duplicateRowCount > 0 && <><button className="ghost-button" type="button" onClick={() => onReviewQualityIssue('duplicates')}>Voir les doublons</button><button className="ghost-button quality-fix-button" type="button" onClick={onRemoveDuplicateRows}>Retirer les doublons</button></>}
                {qualityReport.missingValueCount > 0 && <button className="ghost-button" type="button" onClick={() => onReviewQualityIssue('missing')}>Voir les valeurs manquantes</button>}
              </div> : <div className="quality-clean"><CheckCircle2 size={18} /> Aucun problème détecté.</div>}
            </section>
          )}
          {dataset.id && <div className="dataset-secondary-actions"><button className="ghost-button" type="button" onClick={() => setAreFieldsOpen((current) => !current)}>{areFieldsOpen ? 'Masquer les champs' : `Afficher les ${dataset.fields.length} champs`}</button><button className="ghost-button" type="button" onClick={onOpenGrid}><Table2 size={18} />Ouvrir la grille</button><button className="ghost-button icon-only" type="button" title="Supprimer le dataset" aria-label="Supprimer le dataset" onClick={() => setIsConfirmingDelete(true)}><Trash2 size={18} /></button></div>}
          {areFieldsOpen && <div className="dataset-fields" aria-label="Champs du dataset">{dataset.fields.map((field) => <span key={field.name} title={field.name}><span className="field-name">{field.name}</span><small>{field.type}</small></span>)}</div>}
      </div>
      {isSourceDialogOpen && <div className="source-dialog-backdrop" role="presentation" onMouseDown={() => setIsSourceDialogOpen(false)}>
        <section className="source-dialog" role="dialog" aria-modal="true" aria-label="Ajouter une source" onMouseDown={(event) => event.stopPropagation()}>
          <header><div><strong>Ajouter une source</strong><span>Choisissez la manière de connecter vos données.</span></div><button className="widget-editor-close" type="button" onClick={() => setIsSourceDialogOpen(false)} aria-label="Fermer"><X size={20} /></button></header>
          {importError && <p className="inline-error">{importError}</p>}
          <input ref={importInputRef} className="file-input" type="file" aria-label="Choisir un fichier de données" accept=".csv,.tsv,.xlsx,.xls,.xlsm,.xlsb,text/csv,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={handleImport} />
          <div className="source-choice" aria-label="Type de source">
            <button className={sourceType === 'file' ? 'source-choice-button active' : 'source-choice-button'} type="button" onClick={() => setSourceType('file')}><FileUp size={20} />Fichier</button>
             <button className={sourceType === 'api' ? 'source-choice-button active' : 'source-choice-button'} type="button" onClick={() => setSourceType('api')}><Database size={20} />API</button>
             <button className={sourceType === 'monitor' ? 'source-choice-button active' : 'source-choice-button'} type="button" onClick={() => setSourceType('monitor')}><Activity size={20} />Supervision</button>
          </div>
          {sourceType === 'file' && <button className="primary-button full" type="button" onClick={() => importInputRef.current?.click()} disabled={isImporting}>
            {isImporting ? <LoaderCircle className="spin" size={20} /> : <Upload size={20} />}{isImporting ? 'Import...' : 'Choisir un fichier'}
          </button>}
           {sourceType === 'api' && <ApiConnectionForm onConnected={onConnectApi} />}
            {sourceType === 'monitor' && <MonitorConnectionForm onConnected={onConnectMonitor} />}
        </section>
      </div>}
    </>
  );
}

function MonitorConnectionForm({ onConnected }: { onConnected: DatasetPanelProps['onConnectMonitor'] }) {
  const [config, setConfig] = useState<MonitorSourceConfig>({ name: '', url: '', probeType: 'http', syncFrequency: 'manual' });
  const [isChecking, setIsChecking] = useState(false);

  const update = <K extends keyof MonitorSourceConfig>(key: K, value: MonitorSourceConfig[K]) => setConfig((current) => ({ ...current, [key]: value }));
  const connect = async () => {
    setIsChecking(true);
    try { onConnected(await createMonitorDataset(config)); } finally { setIsChecking(false); }
  };

  return <section className="api-connection-form" aria-label="Surveillance d’application">
    <strong>Surveillance d’application</strong>
    <p className="monitor-form-note">Chaque contrôle crée un événement horodaté exploitable dans le dashboard. Le LLM peut lire ces événements, mais n’est jamais utilisé pour effectuer le ping.</p>
    <label>Nom du service<input value={config.name} onChange={(event) => update('name', event.target.value)} placeholder="Ex. API paiement" /></label>
    <label>Type de sonde<select value={config.probeType} onChange={(event) => update('probeType', event.target.value as MonitorSourceConfig['probeType'])}><option value="http">Disponibilité HTTP</option><option value="dns">Résolution DNS</option><option value="ping">Ping réseau</option></select></label>
    <label>{config.probeType === 'http' ? 'URL de santé' : 'Nom de domaine ou adresse IP'}<input type={config.probeType === 'http' ? 'url' : 'text'} value={config.url} onChange={(event) => update('url', event.target.value)} placeholder={config.probeType === 'http' ? 'https://api.exemple.com/health' : 'exemple.com'} /></label>
    <label>Fréquence de contrôle<select value={config.syncFrequency} onChange={(event) => update('syncFrequency', event.target.value as MonitorSourceConfig['syncFrequency'])}><option value="manual">Manuelle</option><option value="15m">Toutes les 15 min</option><option value="1h">Toutes les heures</option><option value="24h">Tous les jours</option></select></label>
    <button className="primary-button full" type="button" onClick={() => void connect()} disabled={isChecking || !config.url.trim()}>{isChecking ? <LoaderCircle className="spin" size={20} /> : <Activity size={20} />}{isChecking ? 'Vérification...' : 'Ajouter la supervision'}</button>
  </section>;
}

function ApiConnectionForm({ onConnected }: { onConnected: DatasetPanelProps['onConnectApi'] }) {
  const [config, setConfig] = useState<ApiSourceConfig>({ name: '', url: '', method: 'GET', authType: 'none', secret: '', headers: '', queryParams: '', body: '', dataPath: '', syncFrequency: 'manual' });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSecretInput, setShowSecretInput] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState('');
  const update = <K extends keyof ApiSourceConfig>(key: K, value: ApiSourceConfig[K]) => setConfig((current) => ({ ...current, [key]: value }));
  const test = async () => {
    setIsTesting(true); setError('');
    try { const dataset = await fetchApiDataset(config); onConnected(dataset, config); setShowSecretInput(false); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Connexion API impossible.'); } finally { setIsTesting(false); }
  };
  return <section className="api-connection-form" aria-label="Connexion API">
    <strong>Connexion API</strong>
    <label>Nom de la source<input value={config.name} onChange={(event) => update('name', event.target.value)} placeholder="Ex. CRM production" /></label>
    <div className="api-url-row"><label>URL de l’endpoint<input type="url" value={config.url} onChange={(event) => update('url', event.target.value)} placeholder="https://api.exemple.com/v1/rows" /></label><label>Méthode<select value={config.method} onChange={(event) => update('method', event.target.value as ApiSourceConfig['method'])}><option>GET</option><option>POST</option></select></label></div>
    <div className="api-auth-row"><label>Authentification<select value={config.authType} onChange={(event) => { update('authType', event.target.value as ApiSourceConfig['authType']); setShowSecretInput(true); }}><option value="none">Aucune</option><option value="apiKey">Clé API</option><option value="bearer">Bearer token</option><option value="basic">Basic auth</option></select></label>{config.authType !== 'none' && (showSecretInput ? <label>Secret<input type="password" value={config.secret} onChange={(event) => update('secret', event.target.value)} autoComplete="off" /></label> : <button className="ghost-button" type="button" onClick={() => setShowSecretInput(true)}><EyeOff size={16} />Modifier le secret</button>)}</div>
    {config.method === 'POST' && <label>Corps de la requête<textarea value={config.body} onChange={(event) => update('body', event.target.value)} placeholder='{"limit": 100}' /></label>}
    <label>Chemin vers les données<input value={config.dataPath} onChange={(event) => update('dataPath', event.target.value)} placeholder="data.rows (laisser vide pour un tableau racine)" /></label>
    <label>Fréquence de synchronisation<select value={config.syncFrequency} onChange={(event) => update('syncFrequency', event.target.value as ApiSourceConfig['syncFrequency'])}><option value="manual">Manuelle</option><option value="15m">Toutes les 15 min</option><option value="1h">Toutes les heures</option><option value="24h">Tous les jours</option></select></label>
    <button type="button" className="field-disclosure-toggle" onClick={() => setShowAdvanced((current) => !current)} aria-expanded={showAdvanced}><span>Headers et paramètres</span><small>Optionnel</small><ChevronDown className={showAdvanced ? 'chevron open' : 'chevron'} size={16} /></button>
    {showAdvanced && <div className="api-advanced"><label>Headers (JSON)<textarea value={config.headers} onChange={(event) => update('headers', event.target.value)} placeholder='{"Accept":"application/json"}' /></label><label>Paramètres (JSON)<textarea value={config.queryParams} onChange={(event) => update('queryParams', event.target.value)} placeholder='{"limit":100}' /></label></div>}
    {error && <p className="inline-error">{error}</p>}
    <button className="primary-button full" type="button" onClick={() => void test()} disabled={isTesting || !config.url.trim()}>{isTesting ? <LoaderCircle className="spin" size={20} /> : <KeyRound size={20} />}{isTesting ? 'Test en cours...' : 'Tester la connexion'}</button>
  </section>;
}
