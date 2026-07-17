import { useState } from 'react';
import { Eye, EyeOff, KeyRound, LoaderCircle, Sparkles } from 'lucide-react';
import type { LmConfig, LmLogEntry } from '../lmStudio';

type LlmConfigPanelProps = {
  lmConfig: LmConfig;
  onUpdateLmConfig: (patch: Partial<LmConfig>) => void;
  onTestLmConnection: () => Promise<void>;
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
        Modèle
        <input
          value={lmConfig.model}
          placeholder="Nom exact du modèle chargé (obligatoire)"
          onChange={(event) => onUpdateLmConfig({ model: event.target.value })}
        />
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
        <button className="primary-button full" type="button" onClick={() => void onTestLmConnection()} disabled={isTestingLm || !lmConfig.baseUrl.trim()}>
          {isTestingLm ? <LoaderCircle className="spin" size={20} /> : <Sparkles size={20} />}
          Tester la connexion
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
