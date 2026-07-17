import { useEffect, useState } from 'react';
import { Eye, EyeOff, KeyRound, LoaderCircle, RefreshCw, Sparkles } from 'lucide-react';
import type { LmConfig, LmLogEntry } from '../lmStudio';

type LlmConfigPanelProps = {
  lmConfig: LmConfig;
  onUpdateLmConfig: (patch: Partial<LmConfig>) => void;
  onTestLmConnection: () => Promise<string[]>;
  isTestingLm: boolean;
  lmLogs: LmLogEntry[];
};

export function LlmConfigPanel({
  lmConfig,
  onUpdateLmConfig,
  onTestLmConnection,
  isTestingLm,
  lmLogs,
}: LlmConfigPanelProps) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [models, setModels] = useState<string[]>([]);

  const refreshModels = async () => {
    const nextModels = await onTestLmConnection();
    setModels(nextModels);
  };

  useEffect(() => {
    void onTestLmConnection().then(setModels);
  }, [onTestLmConnection]);

  return (
    <div className="llm-config-panel">
      <div className="llm-config-title">
        <KeyRound size={22} />
        <strong>Configuration LLM</strong>
      </div>
      <label>
        Base URL compatible OpenAI
        <input
          value={lmConfig.baseUrl}
          placeholder="/lmstudio/v1 ou https://api.openai.com/v1"
          onChange={(event) => onUpdateLmConfig({ baseUrl: event.target.value })}
        />
      </label>
      <label>
        Modèle chargé dans LM Studio
        <div className="secret-input-row">
          <select value={lmConfig.model} onChange={(event) => onUpdateLmConfig({ model: event.target.value })}>
            {models.length === 0 && <option value="">Actualiser la liste des modèles</option>}
            {models.map((model) => <option key={model} value={model}>{model}</option>)}
          </select>
          <button className="ghost-button icon-only" type="button" title="Actualiser les modèles" onClick={() => void refreshModels()} disabled={isTestingLm}>
            {isTestingLm ? <LoaderCircle className="spin" size={20} /> : <RefreshCw size={20} />}
          </button>
        </div>
        <small>Le premier modèle chargé est choisi automatiquement. Charge un autre modèle dans LM Studio, puis actualise cette liste.</small>
      </label>
      <label>
        API key
        <div className="secret-input-row">
          <input
            type={showApiKey ? 'text' : 'password'}
            value={lmConfig.apiKey}
            placeholder="Optionnel pour LM Studio local"
            autoComplete="off"
            onChange={(event) => onUpdateLmConfig({ apiKey: event.target.value })}
          />
          <button className="ghost-button icon-only" type="button" title={showApiKey ? 'Masquer la clé' : 'Afficher la clé'} onClick={() => setShowApiKey((current) => !current)}>
            {showApiKey ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
      </label>
      <div className="llm-config-grid">
        <label>
          Température
          <input
            type="number"
            min="0"
            max="2"
            step="0.1"
            value={lmConfig.temperature}
            onChange={(event) => onUpdateLmConfig({ temperature: Number(event.target.value) })}
          />
        </label>
        <label>
          Max tokens
          <input
            type="number"
            min="128"
            max="8192"
            step="64"
            value={lmConfig.maxTokens}
            onChange={(event) => onUpdateLmConfig({ maxTokens: Number(event.target.value) })}
          />
        </label>
      </div>
      <div className="llm-config-actions">
        <button className="primary-button full" type="button" onClick={() => void refreshModels()} disabled={isTestingLm || !lmConfig.baseUrl.trim()}>
          {isTestingLm ? <LoaderCircle className="spin" size={20} /> : <Sparkles size={20} />}
          Détecter les modèles chargés
        </button>
      </div>
      <div className="llm-log-panel">
        <strong>Logs LLM</strong>
        {lmLogs.length === 0 ? (
          <span>Aucun appel tracé pour l’instant.</span>
        ) : (
          <ul>
            {lmLogs.slice(-6).map((log) => (
              <li key={`${log.at}-${log.step}-${log.message}`} className={`llm-log-${log.level}`}>
                <small>{new Date(log.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · {log.step}</small>
                <span>{log.message}</span>
                {log.detail && <em>{log.detail}</em>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p>La clé est stockée localement dans ce navigateur.</p>
    </div>
  );
}
