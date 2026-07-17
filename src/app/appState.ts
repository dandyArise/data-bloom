import { defaultLmConfig, type LmConfig, type LmWidgetDraft } from './lmStudio';
import type { ChatMessage, Dataset, DatasetId, Widget, WidgetType } from './types';
import { findFirstFit, getGridSize, migrateWidgetToGrid } from './gridLayout';
import { widgetRegistry } from './widgetRegistry';

export const STORAGE_KEY = 'databloom-state-v2';
export const LEGACY_STORAGE_KEY = 'databloom-mvp-state-v1';

export const emptyDataset: Dataset = {
  id: '',
  name: 'Aucun dataset',
  fields: [],
  rows: [],
};

export type StateValue<T> = T | ((current: T) => T);

export type Conversation = {
  id: string;
  title: string;
  /** Dataset currently selected in this conversation. */
  datasetId: string;
  /** Explicit foreign-key links to every dataset available to this conversation. */
  datasetIds: DatasetId[];
  messages: ChatMessage[];
  widgets: Widget[];
  createdAt: string;
  updatedAt: string;
};

export type PersistedState = {
  datasets: Dataset[];
  activeDatasetId: string;
  conversations: Conversation[];
  activeConversationId: string;
  lmConfig: LmConfig;
  widgets?: Widget[];
  messages?: ChatMessage[];
  dataset?: Dataset;
};

export const widgetLabels = {} as Record<WidgetType, string>;
for (const [type, definition] of widgetRegistry) widgetLabels[type] = definition.label;

export const makeId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;

export const nowIso = () => new Date().toISOString();

export const resolveStateValue = <T,>(value: StateValue<T>, current: T) => (typeof value === 'function' ? (value as (item: T) => T)(current) : value);

export const createConversation = (datasetId = '', title = 'Nouvelle discussion'): Conversation => {
  const createdAt = nowIso();

  return {
    id: makeId('conv'),
    title,
    datasetId,
    datasetIds: datasetId ? [datasetId] : [],
    messages: [],
    widgets: [],
    createdAt,
    updatedAt: createdAt,
  };
};

export const linkDatasetToConversation = (conversation: Conversation, datasetId: DatasetId): Conversation => ({
  ...conversation,
  datasetId,
  datasetIds: Array.from(new Set([...conversation.datasetIds, datasetId])),
});

const generatedAssistantMessages = new Set([
  'Bonjour ! Je suis prêt. Ajoute un dataset quand tu veux analyser des données ou générer des widgets.',
  'Preview workflow ouverte. Le MVP prepare le workflow.yml; l execution reelle viendra avec le backend.',
]);

const sanitizeAssistantMessage = (message: ChatMessage): ChatMessage | null => {
  if (message.role !== 'assistant') return message;

  const text = message.text.trim();
  if (
    generatedAssistantMessages.has(text)
    || /^Le dataset «.+» est bien chargé \(\d+ colonnes, \d+ lignes\)\.$/.test(text)
  ) {
    return null;
  }

  return {
    ...message,
    text: text.replace(/\n\n\d+ proposition\(s\) ajoutée\(s\) en attente de validation\.$/, ''),
  };
};

const removeGeneratedAssistantMessages = (conversations: Conversation[]) => conversations.map((conversation) => ({
  ...conversation,
  messages: conversation.messages
    .map(sanitizeAssistantMessage)
    .filter((message): message is ChatMessage => Boolean(message)),
}));

const createLegacyConversation = (state: Partial<PersistedState>, activeDatasetId: string): Conversation => {
  const createdAt = nowIso();
  const firstUserMessage = state.messages?.find((message) => message.role === 'user')?.text.trim();

  return {
    id: 'conversation-main',
    title: firstUserMessage ? firstUserMessage.slice(0, 42) : 'Discussion locale',
    datasetId: activeDatasetId,
    datasetIds: activeDatasetId ? [activeDatasetId] : [],
    messages: state.messages ?? [],
    widgets: state.widgets ?? [],
    createdAt,
    updatedAt: createdAt,
  };
};

export const loadState = (): PersistedState => {
  const fallbackConversation = createConversation('', 'Discussion locale');
  const fallback = { datasets: [], activeDatasetId: '', conversations: [fallbackConversation], activeConversationId: fallbackConversation.id, lmConfig: defaultLmConfig };

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const state = JSON.parse(raw) as Partial<PersistedState>;
    const storedDatasets = state.datasets ?? (state.dataset?.id ? [state.dataset] : []);
    // v2 used shortened, prefixed ids. Migrate them once so `Dataset.id` is a real UUID.
    const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
    const datasetIdMap = new Map(storedDatasets.map((dataset) => [dataset.id, isUuid(dataset.id) ? dataset.id : crypto.randomUUID()]));
    const remapDatasetId = (id?: string) => (id ? datasetIdMap.get(id) ?? id : '');
    const datasets = storedDatasets.map((dataset) => ({
      ...dataset,
      id: remapDatasetId(dataset.id),
      source: dataset.source?.type === 'monitor' ? { ...dataset.source, probeType: dataset.source.probeType ?? 'http' } : dataset.source,
    }));
    const activeDatasetId = remapDatasetId(state.activeDatasetId ?? state.dataset?.id ?? storedDatasets[0]?.id ?? '');
    const storedConversations = state.conversations?.length ? state.conversations : [createLegacyConversation(state, activeDatasetId)];
    const knownDatasetIds = new Set(datasets.map((dataset) => dataset.id));
    const conversations = removeGeneratedAssistantMessages(storedConversations).map((conversation) => {
      const widgets = conversation.widgets.map((widget) => migrateWidgetToGrid({
        ...widget,
        datasetId: remapDatasetId(widget.datasetId || conversation.datasetId) || undefined,
      }));
      const linkedDatasetIdSet = new Set<string>();
      const linkedDatasetCandidates = [
        ...(conversation.datasetIds ?? []),
        conversation.datasetId,
        ...conversation.messages.map((message) => message.datasetId ?? ''),
        ...widgets.map((widget) => widget.datasetId ?? ''),
      ];
      for (const candidate of linkedDatasetCandidates) {
        const id = remapDatasetId(candidate);
        if (knownDatasetIds.has(id)) linkedDatasetIdSet.add(id);
      }
      const linkedDatasetIds = Array.from(linkedDatasetIdSet);
      const selectedDatasetId = remapDatasetId(conversation.datasetId);

      return {
        ...conversation,
        datasetId: linkedDatasetIds.includes(selectedDatasetId) ? selectedDatasetId : linkedDatasetIds[0] ?? '',
        datasetIds: linkedDatasetIds,
        messages: conversation.messages.map((message) => ({ ...message, datasetId: remapDatasetId(message.datasetId) || undefined })),
        widgets,
      };
    });
    const activeConversationId = state.activeConversationId && conversations.some((conversation) => conversation.id === state.activeConversationId)
      ? state.activeConversationId
      : conversations[0]?.id ?? '';

    return {
      datasets,
      activeDatasetId,
      conversations,
      activeConversationId,
      lmConfig: { ...defaultLmConfig, ...state.lmConfig },
    };
  } catch {
    return fallback;
  }
};

export const createLmProposalWidgets = (drafts: LmWidgetDraft[], datasetId: string, requestId: string, occupied: Widget[] = []): Widget[] => {
  const generationId = requestId;

  const placed = [...occupied];
  return drafts.map((draft, index) => {
    const position = findFirstFit(getGridSize(draft.type), placed);

    const widget: Widget = {
      id: makeId('w'),
      changesetId: `${generationId}-${index + 1}`,
      requestId,
      datasetId: draft.datasetId ?? datasetId,
      title: draft.title,
      type: draft.type,
      status: 'pending',
      x: position.x,
      y: position.y,
      w: position.w,
      h: position.h,
      field: draft.field,
      aggregation: draft.aggregation,
      config: draft.config,
      trend: draft.trend ?? 'via LM Studio',
      description: draft.description,
    };
    placed.push(widget);
    return widget;
  });
};
