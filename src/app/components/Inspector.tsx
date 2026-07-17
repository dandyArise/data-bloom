import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { ArrowDown, BarChart3, Check, ChevronDown, Copy, Database, FileJson, GripVertical, LayoutDashboard, LoaderCircle, Mic, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, RefreshCcw, Search, Send, Settings, ShieldAlert, Sparkles, Table2, Trash2, X } from 'lucide-react';
import { widgetLabels, type Conversation } from '../appState';
import type { ApiSourceConfig } from '../apiSource';
import { ChartWidgetBody } from './charts/ChartWidgetBody';
import { ConversationManager } from './ConversationManager';
import { DatasetPanel } from './DatasetPanel';
import { LlmConfigPanel } from './LlmConfigPanel';
import type { LmConfig, LmLogEntry } from '../lmStudio';
import {
  getMonitorHostField,
  getMonitorStatusField,
  getMonitorTimeField,
  latencyThresholdDefaults,
  percentageThresholdDefaults,
  resolveWidgetThresholds,
} from '../monitoringWidgetEngine';
import type { Aggregation, ChatMessage, Dataset, ViewMode, Widget, WidgetSort, WidgetThresholds, WidgetType } from '../types';
import { getWidgetConfig } from '../widgetEngine';
import { isAggregatableMeasureField } from '../dataProfiling';

type InspectorWidgetSchema = {
  showDimension: boolean;
  dimensionLabel?: string;
  showMeasure: boolean;
  showAggregation: boolean;
  showLimitSort: boolean;
  showColumns: boolean;
  showDescription?: boolean;
  showThresholds?: boolean;
  showMonitoringGrid?: boolean;
  showUnit?: boolean;
  showLimit?: boolean;
  showMonitorTarget?: boolean;
  showHeatmapAxes?: boolean;
  limitLabel?: string;
  showPieDisplay?: boolean;
};
const inspectorWidgetSchemas: Record<WidgetType, InspectorWidgetSchema> = {
  kpi: { showDimension: false, showMeasure: true, showAggregation: true, showLimitSort: false, showColumns: false },
  comparison: { showDimension: false, showMeasure: true, showAggregation: true, showLimitSort: false, showColumns: false },
  'kpi-group': { showDimension: false, showMeasure: false, showAggregation: true, showLimitSort: false, showColumns: true },
  bar: { showDimension: true, dimensionLabel: 'Axe X', showMeasure: true, showAggregation: true, showLimitSort: true, showColumns: false },
  pie: { showDimension: true, dimensionLabel: 'Segment', showMeasure: true, showAggregation: true, showLimitSort: true, showColumns: false, showPieDisplay: true },
  line: { showDimension: true, dimensionLabel: 'Axe X', showMeasure: true, showAggregation: true, showLimitSort: false, showColumns: false },
  heatmap: { showDimension: false, showMeasure: true, showAggregation: true, showLimitSort: false, showColumns: false, showHeatmapAxes: true, showLimit: true, limitLabel: 'Catégories maximum par axe' },
  table: { showDimension: true, dimensionLabel: 'Regroupement (optionnel)', showMeasure: false, showAggregation: false, showLimitSort: true, showColumns: true },
  text: { showDimension: false, showMeasure: false, showAggregation: false, showLimitSort: false, showColumns: false, showDescription: true },
  note: { showDimension: false, showMeasure: false, showAggregation: false, showLimitSort: false, showColumns: false, showDescription: true },
  'service-status': { showDimension: false, showMeasure: false, showAggregation: false, showLimitSort: false, showColumns: false, showUnit: true, showMonitorTarget: true },
  'threshold-line': { showDimension: false, showMeasure: true, showAggregation: false, showLimitSort: false, showColumns: false, showThresholds: true, showUnit: true, showLimit: true, showMonitorTarget: true },
  'radial-gauge': { showDimension: false, showMeasure: true, showAggregation: false, showLimitSort: false, showColumns: false, showThresholds: true, showUnit: true, showMonitorTarget: true },
  'availability-grid': { showDimension: false, showMeasure: false, showAggregation: false, showLimitSort: false, showColumns: false, showThresholds: true, showMonitoringGrid: true, showLimit: true },
};

export function Inspector({
  widget,
  dataset,
  onUpdate,
  onClose,
}: {
  widget?: Widget;
  dataset: Dataset;
  onUpdate: (id: string, patch: Partial<Widget>) => void;
  onClose: () => void;
}) {
  if (!widget) {
    return (
      <div className="widget-editor-backdrop" role="presentation" onMouseDown={onClose}>
        <section className="widget-editor-empty" role="dialog" aria-modal="true" aria-label="Modifier le widget" onMouseDown={(event) => event.stopPropagation()}>
          <p className="empty-state">Sélectionnez un widget sur le canvas avant de l’inspecter.</p>
          <button className="ghost-button" type="button" onClick={onClose}>Fermer</button>
        </section>
      </div>
    );
  }

  return <WidgetEditorModal key={widget.id} widget={widget} dataset={dataset} onUpdate={onUpdate} onClose={onClose} />;
}

function WidgetEditorModal({ widget, dataset, onUpdate, onClose }: { widget: Widget; dataset: Dataset; onUpdate: (id: string, patch: Partial<Widget>) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(widget);
  const resolvedConfig = getWidgetConfig(draft, dataset);
  const schema = inspectorWidgetSchemas[draft.type] ?? {
    showDimension: false,
    showMeasure: false,
    showAggregation: false,
    showLimitSort: false,
    showColumns: false,
  };
  const dimensionField = resolvedConfig.groupBy ?? resolvedConfig.xField ?? draft.field;
  const measureField = resolvedConfig.yField ?? draft.field;
  const heatmapColumnField = resolvedConfig.xField ?? dataset.fields[0]?.name ?? '';
  const heatmapRowField = draft.config?.groupBy && draft.config.groupBy !== heatmapColumnField
    ? draft.config.groupBy
    : dataset.fields.find((field) => field.name !== heatmapColumnField && field.name !== measureField)?.name ?? '';
  const measureFields = dataset.fields.filter(isAggregatableMeasureField);
  const thresholdDefaults = draft.type === 'radial-gauge' ? percentageThresholdDefaults : latencyThresholdDefaults;
  const monitoringThresholds = resolveWidgetThresholds(draft, thresholdDefaults);
  const monitorHostField = getMonitorHostField(dataset, draft) ?? '';
  const monitorTimeField = getMonitorTimeField(dataset, draft) ?? '';
  const monitorStatusField = getMonitorStatusField(dataset, draft) ?? '';
  const monitorTargets: string[] = [];
  if (monitorHostField) {
    const seenTargets = new Set<string>();
    for (const row of dataset.rows) {
      const target = String(row[monitorHostField] ?? '').trim();
      if (target && !seenTargets.has(target)) {
        seenTargets.add(target);
        monitorTargets.push(target);
      }
    }
  }
  const availableColumns = draft.type === 'kpi-group' ? measureFields : dataset.fields;
  const defaultColumns = draft.type === 'kpi-group'
    ? measureFields.slice(0, 3).map((field) => field.name)
    : dataset.fields.map((field) => field.name);
  const selectedColumns = (resolvedConfig.columns ?? defaultColumns).filter((name) =>
    availableColumns.some((field) => field.name === name),
  );
  const updateDraft = (patch: Partial<Widget>) => setDraft((current) => ({ ...current, ...patch }));
  const updateConfig = (patch: NonNullable<Widget['config']>) => updateDraft({ config: { ...draft.config, ...patch } });
  const updateDimension = (field: string) => updateDraft({ field, config: { ...draft.config, xField: field, groupBy: field } });
  const updateMeasure = (field: string) => updateDraft({
    field: draft.type === 'kpi' || draft.type === 'comparison' ? field : draft.field,
    config: { ...draft.config, yField: field },
  });
  const updateAggregation = (aggregation: Aggregation) => updateDraft({
    aggregation,
    config: aggregation === 'count' ? { ...draft.config, yField: undefined } : draft.config,
  });
  const updateThreshold = (key: keyof WidgetThresholds, value: number | WidgetThresholds['direction']) =>
    updateConfig({ thresholds: { ...monitoringThresholds, [key]: value } });
  const apply = () => {
    const { id, ...patch } = draft;
    onUpdate(id, patch);
    onClose();
  };

  return (
    <div className="widget-editor-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="widget-editor-modal" role="dialog" aria-modal="true" aria-labelledby="widget-editor-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="widget-editor-header">
          <div><BarChart3 size={24} /><h2 id="widget-editor-title">Modifier le widget</h2></div>
          <div><span className="widget-type-badge">{widgetLabels[draft.type]}</span><button className="widget-editor-close" type="button" onClick={onClose} aria-label="Fermer"><X size={22} /></button></div>
        </header>
        <div className="widget-editor-content">
          <form className="widget-editor-form" onSubmit={(event) => { event.preventDefault(); apply(); }}>
      <label>
        Titre
        <input value={draft.title} onChange={(event) => updateDraft({ title: event.target.value })} />
      </label>
      {schema.showDimension && (
        <label>
          {schema.dimensionLabel}
          <select value={dimensionField ?? ''} onChange={(event) => updateDimension(event.target.value)}>
            {dataset.fields.map((field) => <option key={field.name}>{field.name}</option>)}
          </select>
        </label>
      )}
      {schema.showMeasure && draft.aggregation !== 'count' && (
        <label>
          Mesure
          <select value={measureField ?? ''} onChange={(event) => updateMeasure(event.target.value)}>
            {measureFields.map((field) => <option key={field.name}>{field.name}</option>)}
          </select>
        </label>
      )}
      {schema.showHeatmapAxes && (
        <div className="widget-editor-field-grid">
          <label>
            Colonnes
            <select value={heatmapColumnField} onChange={(event) => updateDraft({ field: event.target.value, config: { ...draft.config, xField: event.target.value } })}>
              {dataset.fields.map((field) => <option key={field.name} value={field.name} disabled={field.name === heatmapRowField}>{field.name}</option>)}
            </select>
          </label>
          <label>
            Lignes
            <select value={heatmapRowField} onChange={(event) => updateConfig({ groupBy: event.target.value })}>
              {dataset.fields.map((field) => <option key={field.name} value={field.name} disabled={field.name === heatmapColumnField}>{field.name}</option>)}
            </select>
          </label>
        </div>
      )}
      {schema.showMonitorTarget && monitorTargets.length > 1 && (
        <label>
          Service surveillé
          <select value={draft.config?.filterValue ?? ''} onChange={(event) => updateConfig({ filterValue: event.target.value || undefined })}>
            <option value="">Tous les services</option>
            {monitorTargets.map((target) => <option key={target}>{target}</option>)}
          </select>
        </label>
      )}
      {schema.showMonitoringGrid && (
        <div className="widget-editor-monitoring-fields">
          <label>
            Hôte / service
            <select value={monitorHostField} onChange={(event) => updateConfig({ groupBy: event.target.value || undefined })}>
              <option value="">Source du dataset</option>
              {dataset.fields.map((field) => <option key={field.name}>{field.name}</option>)}
            </select>
          </label>
          <label>
            Temps
            <select value={monitorTimeField} onChange={(event) => updateConfig({ xField: event.target.value || undefined })}>
              <option value="">Détection automatique</option>
              {dataset.fields.map((field) => <option key={field.name}>{field.name}</option>)}
            </select>
          </label>
          <label>
            Statut
            <select value={monitorStatusField} onChange={(event) => updateConfig({ yField: event.target.value || undefined })}>
              <option value="">Déduire depuis la mesure</option>
              {dataset.fields.map((field) => <option key={field.name}>{field.name}</option>)}
            </select>
          </label>
        </div>
      )}
      {schema.showAggregation && (
        <label>
          Agrégation
          <select value={draft.aggregation} onChange={(event) => updateAggregation(event.target.value as Aggregation)}>
            {(['sum', 'avg', 'count', 'rate'] as Aggregation[]).map((aggregation) => <option key={aggregation}>{aggregation}</option>)}
          </select>
        </label>
      )}
      {schema.showColumns && (
        <label>
          Colonnes à afficher
          <select multiple value={selectedColumns} onChange={(event) => updateConfig({ columns: Array.from(event.currentTarget.selectedOptions, (option) => option.value) })}>
            {availableColumns.map((field) => <option key={field.name}>{field.name}</option>)}
          </select>
        </label>
      )}
      {schema.showDescription && (
        <label>
          {draft.type === 'note' ? 'Note' : 'Texte'}
          <textarea
            rows={6}
            value={draft.description ?? ''}
            placeholder={draft.type === 'note' ? 'Ajoutez votre contexte, une conclusion ou une consigne…' : 'Décrivez l’insight…'}
            onChange={(event) => updateDraft({ description: event.target.value })}
          />
        </label>
      )}
      {schema.showUnit && (
        <label>
          Unité
          <input
            value={draft.config?.unit ?? (draft.type === 'radial-gauge' ? '%' : 'ms')}
            placeholder="ms, %, s…"
            onChange={(event) => updateConfig({ unit: event.target.value })}
          />
        </label>
      )}
      {schema.showThresholds && (
        <fieldset className="widget-editor-thresholds">
          <legend>Seuils</legend>
          <div className="widget-editor-field-grid">
            <label>Avertissement<input type="number" value={monitoringThresholds.warning} onChange={(event) => updateThreshold('warning', Number(event.target.value))} /></label>
            <label>Critique<input type="number" value={monitoringThresholds.critical} onChange={(event) => updateThreshold('critical', Number(event.target.value))} /></label>
            <label>Minimum<input type="number" value={monitoringThresholds.min} onChange={(event) => updateThreshold('min', Number(event.target.value))} /></label>
            <label>Maximum<input type="number" value={monitoringThresholds.max} onChange={(event) => updateThreshold('max', Number(event.target.value))} /></label>
          </div>
          <label>
            Sens du seuil
            <select value={monitoringThresholds.direction} onChange={(event) => updateThreshold('direction', event.target.value as WidgetThresholds['direction'])}>
              <option value="higher-is-worse">Plus haut = plus grave</option>
              <option value="lower-is-worse">Plus bas = plus grave</option>
            </select>
          </label>
        </fieldset>
      )}
      {schema.showLimit && (
        <label>
          {schema.limitLabel ?? 'Nombre de contrôles affichés'}
          <input type="number" min="2" max="100" value={resolvedConfig.limit} onChange={(event) => updateConfig({ limit: Number(event.target.value) })} />
        </label>
      )}
      {schema.showLimitSort && (
      <div className="widget-editor-field-grid">
        <label>Limite<input type="number" min="1" max="50" value={resolvedConfig.limit} onChange={(event) => updateConfig({ limit: Number(event.target.value) })} /></label>
        <label>Tri
          <select value={resolvedConfig.sort} onChange={(event) => updateConfig({ sort: event.target.value as WidgetSort })}>
            <option value="value_desc">Valeur ↓</option>
            <option value="value_asc">Valeur ↑</option>
            <option value="label_asc">Label A-Z</option>
            <option value="label_desc">Label Z-A</option>
          </select>
        </label>
      </div>
      )}
      {schema.showPieDisplay && (
        <fieldset className="widget-editor-thresholds">
          <legend>Affichage du pie</legend>
          <label>Position de la légende
            <select value={draft.config?.legendPosition ?? 'right'} onChange={(event) => updateConfig({ legendPosition: event.target.value as NonNullable<Widget['config']>['legendPosition'] })}>
              <option value="right">À droite</option>
              <option value="bottom">En bas</option>
              <option value="none">Masquée</option>
            </select>
          </label>
          <label>Contenu de la légende
            <select value={draft.config?.legendDetail ?? 'value_percentage'} onChange={(event) => updateConfig({ legendDetail: event.target.value as NonNullable<Widget['config']>['legendDetail'] })}>
              <option value="label">Libellé seul</option>
              <option value="value">Libellé + valeur</option>
              <option value="percentage">Libellé + pourcentage</option>
              <option value="value_percentage">Libellé + valeur + pourcentage</option>
            </select>
          </label>
          <label>Texte dans les parts
            <select value={draft.config?.sliceLabel ?? 'label_percentage'} onChange={(event) => updateConfig({ sliceLabel: event.target.value as NonNullable<Widget['config']>['sliceLabel'] })}>
              <option value="percentage">Pourcentage</option>
              <option value="value">Valeur</option>
              <option value="label">Libellé</option>
              <option value="label_percentage">Libellé + pourcentage</option>
              <option value="none">Aucun</option>
            </select>
          </label>
        </fieldset>
      )}
          </form>
          <section className="widget-editor-preview" aria-label="Aperçu en direct">
            <h3>Aperçu en direct</h3>
            <div className="widget-editor-preview-card"><ChartWidgetBody widget={draft} dataset={dataset} /></div>
            <p>{dataset.rows.length.toLocaleString('fr-FR')} lignes agrégées</p>
          </section>
        </div>
        <footer className="widget-editor-footer"><button className="ghost-button" type="button" onClick={onClose}>Annuler</button><button className="primary-button" type="button" onClick={apply}>Appliquer</button></footer>
      </section>
    </div>
  );
}
