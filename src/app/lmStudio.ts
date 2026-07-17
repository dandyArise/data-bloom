import type { Aggregation, Dataset, Widget, WidgetConfig, WidgetType } from './types';
import type { MonitorSourceConfig } from './serviceMonitor';
import { isAggregatableMeasureField, profileDataset } from './dataProfiling';
import { getWidgetRecommendations, widgetRegistry } from './widgetRegistry';

export type LmWidgetDraft = {
  datasetId?: string;
  title: string;
  type: WidgetType;
  field: string;
  aggregation: Aggregation;
  config?: WidgetConfig;
  description?: string;
  trend?: string;
};

export type LmMonitorDraft = MonitorSourceConfig;

type LmStudioModelList = {
  data?: { id?: string }[];
};

type LmStudioChatResponse = {
  choices?: {
    message?: {
      content?: string;
      reasoning_content?: string;
    };
    finish_reason?: string;
  }[];
};

export type LmLogLevel = 'info' | 'warn' | 'error';

export type LmLogEntry = {
  at: string;
  level: LmLogLevel;
  step: string;
  message: string;
  detail?: string;
};

type LmInternalTool = 'inspect_dataset' | 'suggest_chart' | 'create_widget';

export type LmAssistantResponse = {
  reply: string;
  widgets: LmWidgetDraft[];
  monitor?: LmMonitorDraft;
  logs: LmLogEntry[];
  model: string;
  responseMode: 'json_schema' | 'text';
  rowsIncluded: boolean;
};

export class LmAssistantError extends Error {
  logs: LmLogEntry[];

  constructor(message: string, logs: LmLogEntry[]) {
    super(message);
    this.logs = logs;
  }
}

export type LmConfig = {
  baseUrl: string;
  model: string;
  apiKey: string;
  temperature: number;
  maxTokens: number;
};

export const defaultLmConfig: LmConfig = {
  baseUrl: '/lmstudio/v1',
  model: '',
  apiKey: '',
  temperature: 0.2,
  maxTokens: 1800,
};

const widgetTypes = new Set<WidgetType>(widgetRegistry.keys());
const aggregations = new Set<Aggregation>(['sum', 'avg', 'count', 'rate']);
const widgetSorts = new Set(['label_asc', 'label_desc', 'value_asc', 'value_desc']);
const analysisRequestPattern = /\b(analyse|analyser|analyse specifique|pourquoi|compare|comparaison|evolution|tendance|distribution|detaille|details)\b/i;
const widgetRequestPattern = /\b(widget|graph|chart|histogramme|camembert|courbe|ligne|kpi|comparaison|comparison|note|annotation|table|tableau|dashboard|visualis|monitoring|supervision|latence|ping|dns|uptime|disponibil)/i;
const multiSourceRequestPattern = /\b(multi[ -]?source|plusieurs sources|plusieurs datasets|deux sources|crois[ée]es? les sources)\b/i;
const widgetClaimPattern = /(?:j['’]ai|nous avons|les widgets?).{0,60}(?:ajout|cré|génér|accept)|tous les widgets.{0,60}(?:accept|prêts)/i;

const buildDatasetContext = (dataset: Dataset, includeRows: boolean) => {
  const profileRows = dataset.rows.slice(0, 100);
  const profiles = profileDataset(dataset);
  const { profile: domainProfile, recommendations } = getWidgetRecommendations(dataset);

  return {
    id: dataset.id,
    name: dataset.name,
    rowCount: dataset.rows.length,
    domain: {
      primary: domainProfile.primaryDomain,
      ranked: domainProfile.rankedDomains.slice(0, 3),
      signals: domainProfile.matchedSignals.slice(0, 12),
      shape: domainProfile.shape,
    },
    recommendedWidgetTypes: recommendations.map((recommendation) => recommendation.type),
    fields: dataset.fields.map((field) => {
      const distinctValues = new Set<string>();
      const numericValues: number[] = [];
      for (const row of profileRows) {
        const value = row[field.name];
        if (value === '' || value == null) continue;
        if (distinctValues.size < 5) distinctValues.add(String(value));
        if (typeof value === 'number') numericValues.push(value);
      }

      return {
        ...field,
        profile: profiles.find((profile) => profile.name === field.name),
        exampleValues: Array.from(distinctValues),
        ...(numericValues.length > 0 ? { min: Math.min(...numericValues), max: Math.max(...numericValues) } : {}),
      };
    }),
    ...(includeRows ? { sampleRows: dataset.rows.slice(0, 20) } : {}),
  };
};

const normalizeLmConfig = (config?: Partial<LmConfig>): LmConfig => ({
  ...defaultLmConfig,
  ...config,
  baseUrl: (config?.baseUrl || defaultLmConfig.baseUrl).trim().replace(/\/+$/, ''),
  model: (config?.model ?? '').trim(),
  apiKey: (config?.apiKey ?? '').trim(),
  temperature: Number.isFinite(config?.temperature) ? Number(config?.temperature) : defaultLmConfig.temperature,
  maxTokens: Number.isFinite(config?.maxTokens) ? Number(config?.maxTokens) : defaultLmConfig.maxTokens,
});

const authHeaders = (config: LmConfig): Record<string, string> => (config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {});

const requestWithTimeout = async (url: string, init?: RequestInit) => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 30000);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
};

class LmRequestError extends Error {
  status?: number;
  body?: string;

  constructor(message: string, status?: number, body?: string) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

const createLog = (logs: LmLogEntry[], level: LmLogLevel, step: string, message: string, detail?: string) => {
  logs.push({
    at: new Date().toISOString(),
    level,
    step,
    message,
    detail,
  });
};

const inferInternalTools = (prompt: string, includeRows: boolean): LmInternalTool[] => {
  const tools = new Set<LmInternalTool>(['inspect_dataset']);
  if (includeRows || widgetRequestPattern.test(prompt)) tools.add('suggest_chart');
  if (widgetRequestPattern.test(prompt)) tools.add('create_widget');
  return [...tools];
};

export const listLmModels = async (config?: Partial<LmConfig>) => {
  const resolvedConfig = normalizeLmConfig(config);
  const modelsResponse = await requestWithTimeout(`${resolvedConfig.baseUrl}/models`, {
    headers: authHeaders(resolvedConfig),
  });

  if (!modelsResponse.ok) {
    throw new Error(`Le serveur LLM ne repond pas sur /models (${modelsResponse.status}).`);
  }

  const models = (await modelsResponse.json()) as LmStudioModelList;
  return (models.data ?? []).map((item) => item.id).filter((id): id is string => Boolean(id));
};

const extractJson = (content: string) => {
  const withoutFence = content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  const start = withoutFence.indexOf('{');
  const end = withoutFence.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('LM Studio a repondu sans objet JSON exploitable.');
  }

  return JSON.parse(withoutFence.slice(start, end + 1)) as { reply?: unknown; widgets?: unknown[] };
};

const normalizeDraft = (value: unknown, datasets: Dataset[], fallbackDataset: Dataset): LmWidgetDraft | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const draft = value as Partial<LmWidgetDraft>;
  const dataset = datasets.find((item) => item.id === draft.datasetId) ?? fallbackDataset;
  const fallbackField = dataset.fields.find(isAggregatableMeasureField)?.name ?? dataset.fields[0]?.name;
  const field = dataset.fields.some((schema) => schema.name === draft.field) ? draft.field : fallbackField;

  if (!draft.title || !draft.type || !widgetTypes.has(draft.type) || !field) {
    return null;
  }

  const aggregation = draft.aggregation && aggregations.has(draft.aggregation) ? draft.aggregation : 'sum';
  const validMeasureNames = new Set<string>();
  for (const schema of dataset.fields) {
    if (isAggregatableMeasureField(schema)) validMeasureNames.add(schema.name);
  }

  return {
    datasetId: dataset.id,
    title: draft.title.slice(0, 80),
    type: draft.type,
    field,
    aggregation,
    config: draft.config && typeof draft.config === 'object' ? {
      xField: dataset.fields.some((schema) => schema.name === draft.config?.xField) ? draft.config.xField : undefined,
      yField: aggregation !== 'count' && draft.config?.yField && validMeasureNames.has(draft.config.yField)
        ? draft.config.yField
        : undefined,
      groupBy: dataset.fields.some((schema) => schema.name === draft.config?.groupBy) ? draft.config.groupBy : undefined,
      columns: Array.isArray(draft.config?.columns)
        ? draft.config.columns.filter((name) => validMeasureNames.has(name)).slice(0, 4)
        : undefined,
      limit: Number.isFinite(draft.config?.limit) ? Math.min(Math.max(Number(draft.config?.limit), 1), 20) : undefined,
      sort: draft.config?.sort && widgetSorts.has(draft.config.sort) ? draft.config.sort : undefined,
      thresholds: draft.config?.thresholds
        && Number.isFinite(draft.config.thresholds.warning)
        && Number.isFinite(draft.config.thresholds.critical)
        ? {
          warning: Number(draft.config.thresholds.warning),
          critical: Number(draft.config.thresholds.critical),
          min: Number.isFinite(draft.config.thresholds.min) ? Number(draft.config.thresholds.min) : undefined,
          max: Number.isFinite(draft.config.thresholds.max) ? Number(draft.config.thresholds.max) : undefined,
          direction: draft.config.thresholds.direction === 'lower-is-worse' ? 'lower-is-worse' : 'higher-is-worse',
        }
        : undefined,
      unit: typeof draft.config?.unit === 'string' ? draft.config.unit.slice(0, 12) : undefined,
      filterValue: typeof draft.config?.filterValue === 'string' ? draft.config.filterValue.slice(0, 80) : undefined,
    } : undefined,
    description: draft.description?.slice(0, draft.type === 'note' ? 1000 : 300),
    trend: draft.trend?.slice(0, 32),
  };
};

export const askLmStudioAssistant = async (
  prompt: string,
  dataset: Dataset,
  widgets: Widget[],
  config?: Partial<LmConfig>,
  availableDatasets: Dataset[] = [dataset],
): Promise<LmAssistantResponse> => {
  const logs: LmLogEntry[] = [];
  const includeRows = analysisRequestPattern.test(prompt);
  const internalTools = inferInternalTools(prompt, includeRows);
  const resolvedConfig = normalizeLmConfig(config);
  const contextDatasets = multiSourceRequestPattern.test(prompt) ? availableDatasets : [dataset];
  const requestTokenBudget = Math.max(resolvedConfig.maxTokens, 1800);
  createLog(
    logs,
    'info',
    'dataset_context',
    includeRows ? 'Contexte dataset avec echantillon de lignes.' : 'Contexte dataset limite au schema et au profil.',
    `${dataset.fields.length} colonnes, ${dataset.rows.length} lignes`,
  );
  createLog(logs, 'info', 'tools', `Outils internes: ${internalTools.join(', ')}.`);
  createLog(logs, 'info', 'model_budget', `Budget de sortie: ${requestTokenBudget} tokens avec le modele configure.`);

  const model = resolvedConfig.model.trim();

  if (!model) {
    throw new Error('Choisis le modele LLM a utiliser. Databloom ne selectionne jamais de modele automatiquement.');
  }

  const systemPrompt = [
    'Tu es l assistant Databloom, un copilote data/dashboard.',
    'Tu dois repondre uniquement en JSON valide, sans markdown.',
    'Format exact: {"reply":"message utile pour l utilisateur","widgets":[],"monitor":null}.',
    'Le champ reply est obligatoire et doit etre une vraie reponse conversationnelle en francais.',
    'Si l utilisateur pose une question normale, reponds dans reply et mets widgets: [].',
    'Quand le dataset ne contient aucun champ, reponds normalement aux messages conversationnels mais mets widgets: [].',
    'Si l utilisateur demande une analyse du dashboard ou des donnees, analyse les champs, les rows et les widgets existants dans reply. Widgets peut rester vide.',
    'Si l utilisateur demande de creer/generer/ajouter des widgets, propose 1 a 3 widgets dans widgets.',
    'Chaque dataset contient un domaine probable, les signaux de detection et recommendedWidgetTypes calcules localement a partir de son schema.',
    'Par defaut, choisis seulement parmi recommendedWidgetTypes pour le dataset concerne. Tu peux utiliser un autre type disponible si l utilisateur le demande explicitement et si ce type convient aux champs.',
    'Ne propose jamais un type absent de availableWidgetTypes : les familles de widgets non encore implementees ne doivent pas etre inventees.',
    'Pour une demande d histogramme, propose un widget de type "bar". Si le champ est categoriel (par exemple produit, pays ou statut), utilise aggregation: "count" pour compter les occurrences. Ne refuse jamais un histogramme seulement parce qu il n y a pas de colonne numerique.',
    'Utilise type "line" uniquement quand config.xField est une date, un mois, une annee, une semaine ou une autre sequence temporelle ordonnee. Pour pays, produit, segment ou categorie, utilise "bar".',
    'Utilise type "comparison" pour comparer la derniere periode a la precedente, type "kpi-group" pour afficher 2 a 4 mesures numeriques via config.columns, et type "note" uniquement pour une annotation libre demandee par l utilisateur.',
    'Pour un dataset de supervision, utilise "service-status" pour le dernier etat, "threshold-line" pour une serie temporelle avec seuils, "radial-gauge" pour une mesure bornee, et "availability-grid" pour croiser hotes et temps.',
    'Les widgets monitoring utilisent config.thresholds avec warning, critical, min, max et direction (higher-is-worse ou lower-is-worse), ainsi que config.unit. Pour cibler un seul hote dans un dataset multi-hotes, utilise config.filterValue. Pour availability-grid, groupBy est l hote, xField le temps et yField le statut.',
    'Pour les charts, utilise config.xField pour l axe ou la dimension, config.yField pour la mesure numerique, config.groupBy pour les categories, config.limit pour limiter les categories.',
    'Un champ numerique n est pas automatiquement une mesure : Year, Month Number, identifiants, codes et numeros sont des dimensions ou des cles. Ne les utilise jamais avec sum, avg ou rate, et ne les place jamais dans un groupe KPI.',
    'Le titre d un bar ou d un pie doit nommer exactement la dimension de config.groupBy et la mesure de config.yField. N ecris jamais "par segment" si groupBy vaut Country.',
    'Pour une heatmap, utilise type "heatmap", config.xField pour les colonnes, config.groupBy pour les lignes et config.yField pour l intensite numerique. Utilise aggregation "count" pour une heatmap de frequence sans mesure.',
    'Si le dataset contient des champs, considere qu il est bien configure. Ne dis jamais qu aucun dataset n est configure dans ce cas.',
    'Par defaut, tu recois uniquement le schema et un profil leger du dataset : ne pretends jamais avoir lu toutes les lignes.',
    'Des lignes d echantillon ne sont fournies que pour une demande d analyse explicite. Base alors tes conclusions sur cet echantillon et indique cette limite.',
    'Les widgets sont seulement des propositions: l utilisateur doit les accepter.',
    'Ne dis jamais qu un widget est ajouté, créé, accepté ou prêt à l emploi si tu ne l as pas inclus dans widgets. Ne dis jamais qu il est accepté : seule l interface peut le faire après une action utilisateur.',
    'Chaque widget doit contenir datasetId et utiliser seulement les champs de ce dataset. Tu peux proposer un dashboard multi-source en choisissant un datasetId différent pour chaque widget, sans supprimer les widgets existants.',
    'Respecte le profil de chaque champ : n utilise pas un champ eligibleForWidgets=false. Mentionne explicitement dans reply les champs exclus, peu remplis ou au format incohérent quand ils sont pertinents pour la demande ; ne les ignore jamais silencieusement.',
    'Ne genere aucun code.',
    'Si l utilisateur demande de surveiller un endpoint, DNS ou ping, retourne monitor avec name, url, probeType (http|dns|ping) et syncFrequency (manual|15m|1h|24h). Bloom cree ensuite cette supervision et son scheduler.',
  ].join('\n');

  const userPrompt = JSON.stringify(
    {
      request: prompt,
      internalTools,
      toolContract: {
        inspect_dataset: 'Lire uniquement le schema, les types, les exemples et les metadonnees fournies.',
        suggest_chart: 'Choisir le type de visualisation et les champs pertinents.',
        create_widget: 'Retourner une proposition dans widgets avec field, aggregation et config.',
      },
      currentDatasetId: dataset.id,
      availableWidgetTypes: Array.from(widgetTypes),
      datasets: contextDatasets.map((item) => buildDatasetContext(item, includeRows)),
      currentBoard: {
        widgets: widgets.map((widget) => ({
          title: widget.title,
          type: widget.type,
          status: widget.status,
          field: widget.field,
          aggregation: widget.aggregation,
          config: widget.config,
        })),
      },
    },
    null,
    2,
  );

  const createBody = (modelName: string, responseFormat: unknown) =>
    JSON.stringify({
      model: modelName,
      temperature: resolvedConfig.temperature,
      max_tokens: requestTokenBudget,
      response_format: responseFormat,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

  const jsonSchemaFormat = {
    type: 'json_schema',
    json_schema: {
      name: 'databloom_assistant_response',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          reply: { type: 'string' },
          monitor: {
            anyOf: [
              { type: 'null' },
              { type: 'object', additionalProperties: false, properties: { name: { type: 'string' }, url: { type: 'string' }, probeType: { type: 'string', enum: ['http', 'dns', 'ping'] }, syncFrequency: { type: 'string', enum: ['manual', '15m', '1h', '24h'] } }, required: ['name', 'url', 'probeType', 'syncFrequency'] },
            ],
          },
          widgets: {
            type: 'array',
            minItems: 0,
            maxItems: 4,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                datasetId: { type: 'string' },
                title: { type: 'string' },
                type: { type: 'string', enum: ['kpi', 'comparison', 'kpi-group', 'pie', 'bar', 'line', 'heatmap', 'table', 'text', 'note', 'service-status', 'threshold-line', 'radial-gauge', 'availability-grid'] },
                field: { type: 'string' },
                aggregation: { type: 'string', enum: ['sum', 'avg', 'count', 'rate'] },
                config: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    xField: { type: 'string' },
                    yField: { type: 'string' },
                    groupBy: { type: 'string' },
                    columns: { type: 'array', items: { type: 'string' }, maxItems: 4 },
                    limit: { type: 'number' },
                    sort: { type: 'string', enum: ['label_asc', 'label_desc', 'value_asc', 'value_desc'] },
                    thresholds: {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        warning: { type: 'number' },
                        critical: { type: 'number' },
                        min: { type: 'number' },
                        max: { type: 'number' },
                        direction: { type: 'string', enum: ['higher-is-worse', 'lower-is-worse'] },
                      },
                      required: ['warning', 'critical', 'min', 'max', 'direction'],
                    },
                    unit: { type: 'string' },
                    filterValue: { type: 'string' },
                  },
                  required: ['xField', 'yField', 'groupBy', 'columns', 'limit', 'sort', 'thresholds', 'unit', 'filterValue'],
                },
                description: { type: 'string' },
                trend: { type: 'string' },
              },
                required: ['datasetId', 'title', 'type', 'field', 'aggregation', 'config', 'description', 'trend'],
            },
          },
        },
        required: ['reply', 'widgets', 'monitor'],
      },
    },
  };

  const requestCompletion = async (modelName: string, responseFormat: unknown, responseMode: LmAssistantResponse['responseMode']) => {
    createLog(logs, 'info', 'request', `Tentative ${responseMode} avec ${modelName}.`);
    const chatResponse = await requestWithTimeout(`${resolvedConfig.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(resolvedConfig) },
      body: createBody(modelName, responseFormat),
    });

    if (!chatResponse.ok) {
      const errorText = await chatResponse.text();
      throw new LmRequestError(`LM Studio a refuse la generation (${chatResponse.status}). ${errorText.slice(0, 180)}`, chatResponse.status, errorText);
    }

    const completion = (await chatResponse.json()) as LmStudioChatResponse;
    const choice = completion.choices?.[0];
    const content = choice?.message?.content;

    if (!content) {
      if (choice?.finish_reason === 'length' && choice.message?.reasoning_content) {
        throw new LmRequestError(`Le modele a atteint sa limite de sortie pendant sa reflexion (${requestTokenBudget} tokens), avant la reponse JSON.`);
      }
      throw new LmRequestError('LM Studio a repondu sans contenu.');
    }

    return { content, modelName, responseMode };
  };

  const parseCompletion = (content: string) => {
    const parsed = extractJson(content);
    if (typeof parsed.reply !== 'string' || !parsed.reply.trim()) {
      throw new Error('LM Studio a repondu sans message exploitable.');
    }

    const reply = parsed.reply.trim();
    const drafts = (parsed.widgets ?? [])
      .map((item) => normalizeDraft(item, availableDatasets, dataset))
      .filter((item): item is LmWidgetDraft => Boolean(item));

    if ((parsed.widgets ?? []).length !== drafts.length) {
      createLog(logs, 'warn', 'validation', `${(parsed.widgets ?? []).length - drafts.length} widget(s) rejetes par validation locale.`);
    }

    if ((parsed.widgets ?? []).length > 0 && drafts.length === 0) {
      throw new Error('Le modele a propose des widgets invalides : aucun widget ne peut etre affiche.');
    }

    if (widgetRequestPattern.test(prompt) && drafts.length === 0 && widgetClaimPattern.test(reply)) {
      throw new Error('Le modele affirme avoir ajoute des widgets, mais n a retourne aucun widget structure a afficher.');
    }

    const candidateMonitor = (parsed as { monitor?: unknown }).monitor;
    const monitorConfig = candidateMonitor && typeof candidateMonitor === 'object' ? candidateMonitor as Record<string, unknown> : null;
    const monitor = monitorConfig && typeof monitorConfig.name === 'string' && typeof monitorConfig.url === 'string'
      && typeof monitorConfig.probeType === 'string' && typeof monitorConfig.syncFrequency === 'string'
      && ['http', 'dns', 'ping'].includes(monitorConfig.probeType) && ['manual', '15m', '1h', '24h'].includes(monitorConfig.syncFrequency)
      ? { name: monitorConfig.name.slice(0, 80), url: monitorConfig.url.trim(), probeType: monitorConfig.probeType, syncFrequency: monitorConfig.syncFrequency } as LmMonitorDraft
      : undefined;
    return { reply, widgets: drafts, monitor };
  };

  const schemaUnsupported = (error: unknown) => error instanceof LmRequestError
    && error.status === 400
    && Boolean(error.body?.match(/response_format|json_schema|schema/i));
  const modelRejected = (error: unknown) => error instanceof LmRequestError
    && Boolean(error.body?.match(/model|not found|loaded|disponible|available/i));

  let lastError: unknown;

  for (const candidate of [model]) {
    try {
      const completion = await requestCompletion(candidate, jsonSchemaFormat, 'json_schema');
      const parsed = parseCompletion(completion.content);
      createLog(logs, 'info', 'success', `Reponse valide avec ${candidate} en mode json_schema.`);
      return { ...parsed, logs, model: completion.modelName, responseMode: completion.responseMode, rowsIncluded: includeRows };
    } catch (error) {
      lastError = error;
      createLog(logs, error instanceof LmRequestError ? 'warn' : 'error', 'json_schema', 'Echec json_schema.', error instanceof Error ? error.message : undefined);

      if (!schemaUnsupported(error) && !modelRejected(error)) {
        try {
          const completion = await requestCompletion(candidate, { type: 'text' }, 'text');
          const parsed = parseCompletion(completion.content);
          createLog(logs, 'info', 'success', `Reponse valide avec ${candidate} en mode text.`);
          return { ...parsed, logs, model: completion.modelName, responseMode: completion.responseMode, rowsIncluded: includeRows };
        } catch (fallbackError) {
          lastError = fallbackError;
          createLog(logs, 'warn', 'text_retry', 'Echec du retry text.', fallbackError instanceof Error ? fallbackError.message : undefined);
        }
      } else if (schemaUnsupported(error)) {
        try {
          createLog(logs, 'warn', 'schema_fallback', 'Le serveur ne supporte pas json_schema, retry en text.');
          const completion = await requestCompletion(candidate, { type: 'text' }, 'text');
          const parsed = parseCompletion(completion.content);
          createLog(logs, 'info', 'success', `Reponse valide avec ${candidate} en mode text.`);
          return { ...parsed, logs, model: completion.modelName, responseMode: completion.responseMode, rowsIncluded: includeRows };
        } catch (fallbackError) {
          lastError = fallbackError;
          createLog(logs, 'warn', 'text_retry', 'Echec du retry text.', fallbackError instanceof Error ? fallbackError.message : undefined);
        }
      }

    }
  }

  const message = lastError instanceof Error ? lastError.message : 'Erreur inconnue pendant l appel LM Studio.';
  throw new LmAssistantError(message, logs);
};
