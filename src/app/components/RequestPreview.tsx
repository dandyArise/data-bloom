import { useState } from 'react';
import { prepareAssistantRequest, type LmConfig } from '../lmStudio';
import type { Dataset, Widget } from '../types';
import { expandWidgetSlashCommand } from '../widgetCommands';

type Props = {
  prompt: string;
  dataset: Dataset;
  datasets: Dataset[];
  widgets: Widget[];
  config: LmConfig;
  onRowsChange: (include: boolean) => void;
};

export function RequestPreview({ prompt, dataset, datasets, widgets, config, onRowsChange }: Props) {
  const [open, setOpen] = useState(false);
  const request = open ? prepareAssistantRequest(expandWidgetSlashCommand(prompt.trim()), dataset, widgets, config, datasets) : null;
  const destination = config.provider === 'codex' ? 'Codex · OpenAI' : 'LM Studio · ' + config.baseUrl;
  return <section className="request-preview" aria-label="Données envoyées">
    <label><input type="checkbox" checked={config.includeRows} onChange={event => onRowsChange(event.target.checked)} />
      Inclure des exemples de lignes (jusqu’à 6 par source)</label>
    <button type="button" className="ghost-button" aria-expanded={open} onClick={() => setOpen(!open)}>
      {open ? 'Masquer' : 'Voir'} la requête · {destination}
    </button>
    {request && <div className="request-preview-content">
      <p>{config.includeRows ? 'Exemples de lignes et de valeurs inclus.' : 'Schéma et statistiques inclus. Exemples de lignes et de valeurs exclus.'}</p>
      <code>POST {request.endpoint}</code>
      <pre aria-label="Corps de la requête">{JSON.stringify(JSON.parse(request.body), null, 2)}</pre>
    </div>}
  </section>;
}
