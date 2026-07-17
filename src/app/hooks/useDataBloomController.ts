import { useCallback, useEffect, useMemo, useReducer, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { LEGACY_STORAGE_KEY, STORAGE_KEY, createConversation, createLmProposalWidgets, emptyDataset, linkDatasetToConversation, loadState, makeId, nowIso, resolveStateValue, type Conversation, type StateValue } from '../appState';
import type { ApiSourceConfig } from '../apiSource';
import { removeDuplicateDatasetRows } from '../dataQuality';
import { importDatasetsFromFile } from '../datasetImport';
import { clampGridRect, collides, findFirstFit, getGridSize } from '../gridLayout';
import { LmAssistantError, askLmStudioAssistant, listLmModels, type LmConfig, type LmLogEntry } from '../lmStudio';
import { appendMonitorEvent, createMonitorDataset } from '../serviceMonitor';
import type { ChatMessage, Dataset, ViewMode, Widget, WidgetStatus } from '../types';
import { expandWidgetSlashCommand } from '../widgetCommands';

type WorkspaceUiState = { selectedId: string; viewMode: ViewMode; gridQualityFilter: 'duplicates' | 'missing' | null };
type WorkspaceUiAction =
  | { type: 'select-widget'; id: string }
  | { type: 'set-view'; viewMode: ViewMode }
  | { type: 'set-quality-filter'; filter: WorkspaceUiState['gridQualityFilter'] }
  | { type: 'reset'; selectedId?: string };

function workspaceUiReducer(state: WorkspaceUiState, action: WorkspaceUiAction): WorkspaceUiState {
  switch (action.type) {
    case 'select-widget': return { ...state, selectedId: action.id };
    case 'set-view': return { ...state, viewMode: action.viewMode };
    case 'set-quality-filter': return { ...state, gridQualityFilter: action.filter };
    case 'reset': return { selectedId: action.selectedId ?? '', viewMode: 'board', gridQualityFilter: null };
  }
}

export function useDataBloomController() {
  const [initialState] = useState(loadState);
  const [conversations, setConversations] = useState<Conversation[]>(initialState.conversations);
  const [activeConversationId, setActiveConversationId] = useState(initialState.activeConversationId);
  const [datasets, setDatasets] = useState<Dataset[]>(initialState.datasets);
  const [activeDatasetId, setActiveDatasetId] = useState(initialState.activeDatasetId);
  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId) ?? conversations[0];
  const conversationDatasetId = activeConversation?.datasetId || activeDatasetId;
  const dataset = datasets.find((item) => item.id === conversationDatasetId) ?? datasets.find((item) => item.id === activeDatasetId) ?? emptyDataset;
  const llmDataset = datasets.find((item) => item.id === activeConversation?.llmDatasetId) ?? dataset;
  const messages = activeConversation?.messages ?? [];
  const widgets = activeConversation?.widgets ?? [];
  const [workspaceUi, dispatchWorkspaceUi] = useReducer(workspaceUiReducer, undefined, (): WorkspaceUiState => ({ selectedId: activeConversation?.widgets[0]?.id ?? '', viewMode: 'board', gridQualityFilter: null }));
  const selectedId = workspaceUi.selectedId;
  const viewMode = workspaceUi.viewMode;
  const gridQualityFilter = workspaceUi.gridQualityFilter;
  const setSelectedId = useCallback((id: string | ((current: string) => string)) => dispatchWorkspaceUi({ type: 'select-widget', id: typeof id === 'function' ? id(workspaceUi.selectedId) : id }), [workspaceUi.selectedId]);
  const setViewMode = useCallback((mode: ViewMode) => dispatchWorkspaceUi({ type: 'set-view', viewMode: mode }), []);
  const setGridQualityFilter = useCallback((filter: WorkspaceUiState['gridQualityFilter']) => dispatchWorkspaceUi({ type: 'set-quality-filter', filter }), []);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [lmConfig, setLmConfig] = useState<LmConfig>(initialState.lmConfig);
  const [isLmConfigOpen, setIsLmConfigOpen] = useState(false);
  const [isTestingLm, setIsTestingLm] = useState(false);
  const [lmStatus, setLmStatus] = useState('LM Studio pret via :1234');
  const [lmLogs, setLmLogs] = useState<LmLogEntry[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [chatPanelWidth, setChatPanelWidth] = useState(500);
  const [assistantMode, setAssistantMode] = useState<'Rapide' | 'Approfondi'>('Approfondi');

  useEffect(() => {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ conversations, datasets, activeDatasetId, activeConversationId, lmConfig }));
  }, [activeConversationId, activeDatasetId, conversations, datasets, lmConfig]);

  const selectedWidget = selectedId ? widgets.find((widget) => widget.id === selectedId) : undefined;
  const selectedWidgetDataset = selectedWidget
    ? datasets.find((item) => item.id === selectedWidget.datasetId) ?? emptyDataset
    : dataset;
  const datasetWidgets = widgets;
  const activeWidgets = datasetWidgets.filter((widget) => widget.status !== 'rejected');
  const pendingWidgets = datasetWidgets.filter((widget) => widget.status === 'pending');
  const acceptedWidgets = datasetWidgets.filter((widget) => widget.status === 'accepted');
  const dashboardTitle = activeConversation?.title.trim() || (dataset.id ? dataset.name : 'Aucun dataset');
  const boardId = activeConversation ? `board-${activeConversation.id}` : 'board-main';

  const uiJson = useMemo(
    () => ({
      product: 'Databloom',
      board: {
        id: boardId,
        name: dashboardTitle,
        datasetId: dataset.id,
        pages: [
          {
            id: 'page-board',
            name: 'Board',
            widgets: acceptedWidgets,
          },
        ],
      },
    }),
    [acceptedWidgets, boardId, dashboardTitle, dataset.id],
  );

  const workflowYaml = useMemo(
    () =>
      [
        'name: databloom_sales_refresh',
        'trigger:',
        '  type: manual',
        'source:',
        `  datasetId: ${dataset.id}`,
        'steps:',
        '  - id: infer_schema',
        '    uses: databloom.schema.infer',
        '  - id: rebuild_board',
        '    uses: databloom.board.refresh',
        'output:',
        `  boardId: ${boardId}`,
      ].join('\n'),
    [boardId, dataset.id],
  );

  const updateActiveConversation = useCallback((updater: (conversation: Conversation) => Conversation) => {
    setConversations((current) => current.map((conversation) => {
      if (conversation.id !== activeConversationId) {
        return conversation;
      }

      const next = updater(conversation);
      return { ...next, updatedAt: nowIso() };
    }));
  }, [activeConversationId]);

  const setWidgets = useCallback((value: StateValue<Widget[]>) => {
    updateActiveConversation((conversation) => ({
      ...conversation,
      widgets: resolveStateValue(value, conversation.widgets),
    }));
  }, [updateActiveConversation]);

  const setMessages = useCallback((value: StateValue<ChatMessage[]>) => {
    updateActiveConversation((conversation) => ({
      ...conversation,
      messages: resolveStateValue(value, conversation.messages),
    }));
  }, [updateActiveConversation]);

  const selectDataset = useCallback((id: string) => {
    setActiveDatasetId(id);
    updateActiveConversation((conversation) => linkDatasetToConversation(conversation, id));
    setSelectedId('');
  }, [updateActiveConversation]);

  const selectLmDataset = useCallback((id: string) => {
    if (!datasets.some((item) => item.id === id)) return;
    updateActiveConversation((conversation) => ({
      ...conversation,
      llmDatasetId: id,
      datasetIds: Array.from(new Set([...conversation.datasetIds, id])),
    }));
  }, [datasets, updateActiveConversation]);

  const createNewConversation = useCallback(() => {
    const conversation = createConversation(dataset.id);
    setConversations((current) => [conversation, ...current]);
    setActiveConversationId(conversation.id);
    setActiveDatasetId(dataset.id);
    setSelectedId('');
    setPrompt('');
    setViewMode('board');
  }, [dataset.id]);

  const openConversation = useCallback((id: string) => {
    const conversation = conversations.find((item) => item.id === id);
    if (!conversation) {
      return;
    }

    setActiveConversationId(id);
    setActiveDatasetId(conversation.datasetId);
    setSelectedId(conversation.widgets.find((widget) => widget.status !== 'rejected')?.id ?? '');
    setPrompt('');
    setViewMode('board');
  }, [conversations]);

  const renameConversation = useCallback((id: string, title: string) => {
    setConversations((current) => current.map((conversation) => (
      conversation.id === id ? { ...conversation, title, updatedAt: nowIso() } : conversation
    )));
  }, []);

  const deleteConversation = useCallback((id: string) => {
    setConversations((current) => {
      const target = current.find((conversation) => conversation.id === id);
      if (!target) {
        return current;
      }

      if (current.length <= 1) {
        if (target.messages.length === 0 && target.widgets.length === 0) {
          return current;
        }

        const replacement = createConversation(dataset.id, 'Discussion locale');
        setActiveConversationId(replacement.id);
        setActiveDatasetId(replacement.datasetId);
        setSelectedId('');
        return [replacement];
      }

      const next = current.filter((conversation) => conversation.id !== id);
      if (id === activeConversationId) {
        const replacement = next[0];
        setActiveConversationId(replacement.id);
        setActiveDatasetId(replacement.datasetId);
        setSelectedId(replacement.widgets.find((widget) => widget.status !== 'rejected')?.id ?? '');
      }

      return next;
    });
  }, [activeConversationId, dataset.id]);

  const updateWidget = useCallback((id: string, patch: Partial<Widget>) => {
    setWidgets((current) => {
      const target = current.find((widget) => widget.id === id);
      if (!target) return current;
      const changesLayout = patch.x !== undefined || patch.y !== undefined || patch.w !== undefined || patch.h !== undefined;
      const patchedWidget = { ...target, ...patch };
      const next = changesLayout ? { ...patchedWidget, ...clampGridRect(patchedWidget) } : patchedWidget;
      if (changesLayout && collides(next, current, id)) return current;
      return current.map((widget) => (widget.id === id ? next : widget));
    });
  }, [setWidgets]);

  const importDataset = useCallback(async (file: File) => {
    setIsImporting(true);
    setImportError('');

    try {
      const resolvedDatasets = await importDatasetsFromFile(file);
      if (resolvedDatasets.length === 0) {
        throw new Error('Aucune ligne exploitable trouvee dans ce fichier.');
      }

      const nextActiveDatasetId = resolvedDatasets[0].id;
      setDatasets((current) => [...current, ...resolvedDatasets]);
      setActiveDatasetId(nextActiveDatasetId);
      updateActiveConversation((conversation) => ({
        ...resolvedDatasets.reduce((linkedConversation, nextDataset) => (
          linkDatasetToConversation(linkedConversation, nextDataset.id)
        ), conversation),
        llmDatasetId: nextActiveDatasetId,
      }));
      setLmStatus(`${resolvedDatasets.length} dataset(s) importé(s)`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import impossible.';
      setImportError(message);
      setLmStatus('Erreur import dataset');
    } finally {
      setIsImporting(false);
    }
  }, [updateActiveConversation]);

  const connectApiDataset = useCallback((nextDataset: Dataset, source: Pick<ApiSourceConfig, 'url' | 'syncFrequency'>) => {
    setDatasets((current) => [...current, { ...nextDataset, source: { type: 'api', ...source, lastSyncedAt: nowIso() } }]);
    setActiveDatasetId(nextDataset.id);
    updateActiveConversation((conversation) => ({
      ...linkDatasetToConversation(conversation, nextDataset.id),
      llmDatasetId: nextDataset.id,
    }));
    setLmStatus(`API connectée : ${nextDataset.rows.length} lignes, ${nextDataset.fields.length} colonnes`);
  }, [updateActiveConversation]);

  const connectMonitorDataset = useCallback((nextDataset: Dataset) => {
    setDatasets((current) => [...current, nextDataset]);
    setActiveDatasetId(nextDataset.id);
    updateActiveConversation((conversation) => ({
      ...linkDatasetToConversation(conversation, nextDataset.id),
      llmDatasetId: nextDataset.id,
    }));
    setLmStatus(`Supervision ajoutée : ${nextDataset.name}`);
  }, [updateActiveConversation]);

  const checkMonitorDataset = useCallback(async (datasetId: string) => {
    const target = datasets.find((item) => item.id === datasetId);
    if (!target?.source || target.source.type !== 'monitor') return;
    setLmStatus(`Vérification de ${target.name}…`);
    const nextDataset = await appendMonitorEvent(target);
    setDatasets((current) => current.map((item) => item.id === datasetId ? nextDataset : item));
    setLmStatus(nextDataset.source?.type === 'monitor' && nextDataset.source.lastStatus === 'up' ? `${target.name} est disponible` : `${target.name} requiert votre attention`);
  }, [datasets]);

  useEffect(() => {
    const delays: Record<'15m' | '1h' | '24h', number> = { '15m': 15 * 60_000, '1h': 60 * 60_000, '24h': 24 * 60 * 60_000 };
    const intervals = datasets.flatMap((item) => {
      if (item.source?.type !== 'monitor' || item.source.syncFrequency === 'manual') return [];
      return [window.setInterval(() => { void checkMonitorDataset(item.id); }, delays[item.source.syncFrequency])];
    });
    return () => intervals.forEach((interval) => window.clearInterval(interval));
  }, [datasets, checkMonitorDataset]);

  const updateLmConfig = useCallback((patch: Partial<LmConfig>) => {
    setLmConfig((current) => ({ ...current, ...patch }));
  }, []);

  const testLmConnection = useCallback(async (): Promise<string[]> => {
    setIsTestingLm(true);
    setLmStatus('Test connexion LLM...');

    try {
      const models = await listLmModels(lmConfig);
      if (models.length > 0 && (!lmConfig.model || !models.includes(lmConfig.model))) {
        setLmConfig((current) => ({ ...current, model: models[0] }));
      }
      setLmLogs([{
        at: nowIso(),
        level: 'info',
        step: 'models',
        message: models.length > 0 ? `${models.length} modele(s) detecte(s).` : 'Connexion OK, mais aucun modele liste.',
        detail: models.slice(0, 5).join(', '),
      }]);
      setLmStatus(models.length > 0 ? `LLM OK - ${models.length} modele(s)` : 'LLM OK - aucun modele liste');
      return models;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connexion LLM impossible.';
      setLmLogs([{ at: nowIso(), level: 'error', step: 'models', message: 'Test de connexion echoue.', detail: message }]);
      setLmStatus(`LLM erreur: ${message}`);
      return [];
    } finally {
      setIsTestingLm(false);
    }
  }, [lmConfig]);

  const renameDataset = useCallback((id: string, name: string) => {
    setDatasets((current) => current.map((item) => item.id === id ? { ...item, name } : item));
  }, []);

  const deleteDataset = useCallback((id: string) => {
    setDatasets((current) => {
      const next = current.filter((item) => item.id !== id);
      const fallbackDatasetId = next[0]?.id ?? '';
      setActiveDatasetId(fallbackDatasetId);
      setConversations((conversationList) => conversationList.map((conversation) => {
        if (!conversation.datasetIds.includes(id)) return conversation;
        const datasetIds = conversation.datasetIds.filter((datasetId) => datasetId !== id);
        return {
          ...conversation,
          datasetId: conversation.datasetId === id ? datasetIds[0] ?? fallbackDatasetId : conversation.datasetId,
          llmDatasetId: conversation.llmDatasetId === id ? datasetIds[0] ?? fallbackDatasetId : conversation.llmDatasetId,
          datasetIds,
          widgets: conversation.widgets.filter((widget) => widget.datasetId !== id),
          updatedAt: nowIso(),
        };
      }));
      return next;
    });
  }, []);

  const removeDuplicateRows = useCallback(() => {
    if (!dataset.id) return;
    setDatasets((current) => current.map((item) => item.id === dataset.id ? { ...item, rows: removeDuplicateDatasetRows(item) } : item));
    setLmStatus('Lignes dupliquées supprimées');
  }, [dataset.id]);

  const addAssistantResponse = useCallback((assistantText: string, proposals: Widget[] = [], datasetId: string, requestId: string) => {
    if (proposals.length > 0) {
      setWidgets((current) => [...current, ...proposals]);
      setSelectedId(proposals[0].id);
      setViewMode('board');
    }

    const proposalNotice = proposals.length > 0
      ? `\n\n${proposals.length} proposition(s) sont visibles sur le canvas et en attente de validation.`
      : '';
    setMessages((current) => [
      ...current,
      {
        id: makeId('m'),
        role: 'assistant',
        text: `${assistantText}${proposalNotice}`,
        datasetId,
        requestId,
        createdAt: nowIso(),
      },
    ]);
  }, [setMessages, setWidgets]);

  const generate = useCallback(async (promptOverride?: string, options?: { datasetId?: string }) => {
    if (isGenerating) {
      return;
    }

    const submittedPrompt = (promptOverride ?? prompt).trim();
    if (!submittedPrompt) {
      return;
    }

    setIsGenerating(true);
    if (activeConversation && ['Nouvelle discussion', 'Discussion locale'].includes(activeConversation.title)) {
      const title = submittedPrompt.replace(/^(?:\/[a-z0-9-]+\s*)+/i, '').trim() || submittedPrompt;
      updateActiveConversation((conversation) => ({ ...conversation, title: title.slice(0, 48) }));
    }
    const lmPrompt = expandWidgetSlashCommand(submittedPrompt);
    if (!promptOverride) setPrompt('');
    setLmStatus('Connexion a LM Studio...');
    const datasetForRequest = datasets.find((item) => item.id === options?.datasetId) ?? llmDataset;
    const widgetsForRequest = activeWidgets;
    const requestId = makeId('req');
    setMessages((current) => [
      ...current,
      { id: makeId('m'), role: 'user', text: submittedPrompt, datasetId: datasetForRequest.id, requestId, createdAt: nowIso() },
    ]);

    try {
      const assistantResponse = await askLmStudioAssistant(lmPrompt, datasetForRequest, widgetsForRequest, lmConfig, datasets);
      setLmLogs(assistantResponse.logs);
      if (assistantResponse.monitor) {
        const monitorDataset = await createMonitorDataset(assistantResponse.monitor);
        connectMonitorDataset(monitorDataset);
      }
      const proposals = createLmProposalWidgets(assistantResponse.widgets, datasetForRequest.id, requestId, widgetsForRequest);
      addAssistantResponse(assistantResponse.reply, proposals, datasetForRequest.id, requestId);
      setLmStatus(proposals.length > 0 ? `LM Studio OK - ${assistantResponse.model} - ${proposals.length} proposition(s)` : `LM Studio OK - ${assistantResponse.model}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue pendant l appel LM Studio.';
      if (error instanceof LmAssistantError) {
        setLmLogs(error.logs);
      }
      setMessages((current) => [
        ...current,
        {
          id: makeId('m'),
          role: 'assistant',
          text: `Erreur LM Studio: ${message}`,
          datasetId: datasetForRequest.id,
          requestId,
          createdAt: nowIso(),
        },
      ]);
      setLmStatus('LM Studio erreur');
    } finally {
      setIsGenerating(false);
    }
  }, [activeConversation, activeWidgets, addAssistantResponse, connectMonitorDataset, datasets, isGenerating, llmDataset, lmConfig, prompt, setMessages, updateActiveConversation]);

  const retryLastTurn = useCallback(() => {
    const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user');
    if (!lastUserMessage || isGenerating) {
      return;
    }

    const retryDatasetId = lastUserMessage.datasetId ?? llmDataset.id;
    if (retryDatasetId) {
      selectLmDataset(retryDatasetId);
    }

    if (lastUserMessage.requestId) {
      setWidgets((current) => current.filter((widget) => widget.requestId !== lastUserMessage.requestId));
      setMessages((current) => {
        let lastUserIndex = -1;
        for (let index = current.length - 1; index >= 0; index -= 1) {
          if (current[index].id === lastUserMessage.id) {
            lastUserIndex = index;
            break;
          }
        }
        return lastUserIndex >= 0 ? current.slice(0, lastUserIndex) : current;
      });
    }

    void generate(lastUserMessage.text, { datasetId: retryDatasetId });
  }, [generate, isGenerating, llmDataset.id, messages, selectLmDataset, setMessages, setWidgets]);

  const acceptWidget = useCallback((id: string) => updateWidget(id, { status: 'accepted' }), [updateWidget]);
  const rejectWidget = useCallback((id: string) => updateWidget(id, { status: 'rejected' }), [updateWidget]);

  const duplicateWidget = useCallback((widget: Widget) => {
    const duplicate = {
      ...widget,
      id: makeId('w'),
      changesetId: undefined,
      title: `${widget.title} copie`,
      status: 'accepted' as WidgetStatus,
      ...findFirstFit(getGridSize(widget.type), widgets),
    };
    setWidgets((current) => [...current, duplicate]);
    setSelectedId(duplicate.id);
  }, [setWidgets, widgets]);

  const deleteWidget = useCallback((id: string) => {
    setWidgets((current) => current.filter((widget) => widget.id !== id));
    setSelectedId((currentId) => (currentId === id ? '' : currentId));
  }, [setWidgets]);

  const resetBoard = useCallback(() => {
    setWidgets([]);
    setMessages([]);
    dispatchWorkspaceUi({ type: 'reset' });
  }, [setMessages, setWidgets]);

  const clearConversation = useCallback(() => {
    setMessages([]);
  }, [setMessages]);

  const togglePresentationMode = useCallback(() => {
    setIsPresentationMode((current) => {
      const next = !current;

      if (next) {
        setViewMode('board');
      }

      return next;
    });
  }, []);

  const showNav = !isPresentationMode;
  const showChat = isChatOpen && !isPresentationMode;
  const showInspector = isInspectorOpen && !isPresentationMode;
  const workspaceColumns = `${showNav ? '96px ' : ''}${showChat ? `${chatPanelWidth}px ` : ''}minmax(0, 1fr)`;

  const selectWidget = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const startChatResize = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const origin = { pointerX: event.clientX, width: chatPanelWidth };

    const move = (moveEvent: globalThis.PointerEvent) => {
      const nextWidth = origin.width + moveEvent.clientX - origin.pointerX;
      const stageReserve = 680;
      const maxWidth = Math.max(360, window.innerWidth - (showNav ? 96 : 0) - stageReserve);
      setChatPanelWidth(Math.min(820, maxWidth, Math.max(360, nextWidth)));
    };

    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  }, [chatPanelWidth, showNav]);

  return {
    isPresentationMode,
    pendingWidgets,
    resetBoard,
    togglePresentationMode,
    workspaceColumns,
    showNav,
    viewMode,
    setViewMode,
    isChatOpen,
    isInspectorOpen,
    setIsChatOpen,
    setIsInspectorOpen,
    showChat,
    conversations,
    activeConversation,
    createNewConversation,
    openConversation,
    renameConversation,
    deleteConversation,
    messages,
    dataset,
    llmDataset,
    datasets,
    selectDataset,
    selectLmDataset,
    prompt,
    setPrompt,
    generate,
    retryLastTurn,
    clearConversation,
    isGenerating,
    lmConfig,
    updateLmConfig,
    isLmConfigOpen,
    setIsLmConfigOpen,
    testLmConnection,
    isTestingLm,
    lmLogs,
    assistantMode,
    setAssistantMode,
    startChatResize,
    chatPanelWidth,
    acceptWidget,
    rejectWidget,
    selectWidget,
    activeWidgets,
    selectedId,
    updateWidget,
    deleteWidget,
    acceptedWidgets,
    isImporting,
    importError,
    renameDataset,
    deleteDataset,
    importDataset,
    setGridQualityFilter,
    removeDuplicateRows,
    connectApiDataset,
    connectMonitorDataset,
    checkMonitorDataset,
    gridQualityFilter,
    uiJson,
    workflowYaml,
    showInspector,
    selectedWidget,
    selectedWidgetDataset,
    dashboardTitle,
  };
}
