import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { ArrowDown, BarChart3, Check, ChevronDown, Copy, Database, FileJson, GripVertical, LayoutDashboard, LoaderCircle, Mic, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, RefreshCcw, Search, Send, Settings, ShieldAlert, Sparkles, Table2, Trash2, X } from 'lucide-react';
import { widgetLabels, type Conversation } from '../appState';
import type { ApiSourceConfig } from '../apiSource';
import { ChartWidgetBody } from './charts/ChartWidgetBody';
import { ConversationManager } from './ConversationManager';
import { DatasetPanel } from './DatasetPanel';
import { LlmConfigPanel } from './LlmConfigPanel';
import { WidgetCommandComposer } from './WidgetCommandComposer';
import type { LmConfig, LmLogEntry } from '../lmStudio';
import type { Aggregation, ChatMessage, Dataset, ViewMode, Widget, WidgetSort } from '../types';

type ChatPanelMode = {
  generation: 'idle' | 'generating';
  configuration: 'closed' | 'open';
  connectionTest: 'idle' | 'testing';
  layout: 'standard' | 'wide';
};

export function ChatPanel({
  conversations,
  activeConversationId,
  activeConversationTitle,
  onNewConversation,
  onOpenConversation,
  onRenameConversation,
  onDeleteConversation,
  messages,
  dataset,
  datasets,
  onSelectDataset,
  pendingWidgets,
  activeWidgetCount,
  prompt,
  setPrompt,
  onGenerate,
  onRetry,
  onClearHistory,
  mode,
  lmConfig,
  onUpdateLmConfig,
  onToggleLmConfig,
  onTestLmConnection,
  lmLogs,
  onOpenGrid,
  onOpenData,
  assistantMode,
  onToggleAssistantMode,
  onResizeStart,
  onAccept,
  onReject,
  onSelect,
}: {
  conversations: Conversation[];
  activeConversationId: string;
  activeConversationTitle: string;
  onNewConversation: () => void;
  onOpenConversation: (id: string) => void;
  onRenameConversation: (id: string, title: string) => void;
  onDeleteConversation: (id: string) => void;
  messages: ChatMessage[];
  dataset: Dataset;
  datasets: Dataset[];
  onSelectDataset: (id: string) => void;
  pendingWidgets: Widget[];
  activeWidgetCount: number;
  prompt: string;
  setPrompt: (value: string) => void;
  onGenerate: (promptOverride?: string, options?: { datasetId?: string }) => Promise<void>;
  onRetry: () => void;
  onClearHistory: () => void;
  mode: ChatPanelMode;
  lmConfig: LmConfig;
  onUpdateLmConfig: (patch: Partial<LmConfig>) => void;
  onToggleLmConfig: () => void;
  onTestLmConnection: () => Promise<void>;
  lmLogs: LmLogEntry[];
  onOpenGrid: () => void;
  onOpenData: () => void;
  assistantMode: 'Rapide' | 'Approfondi';
  onToggleAssistantMode: () => void;
  onResizeStart: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const isGenerating = mode.generation === 'generating';
  const isLmConfigOpen = mode.configuration === 'open';
  const isTestingLm = mode.connectionTest === 'testing';
  const isWide = mode.layout === 'wide';
  const canDeleteConversation = conversations.length > 1 || messages.length > 0 || activeWidgetCount > 0;
  const messagesRef = useRef<HTMLDivElement>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const lastMessageId = messages[messages.length - 1]?.id;

  const updateScrollPosition = () => {
    const container = messagesRef.current;
    if (!container) return;
    setShowScrollToBottom(container.scrollHeight - container.scrollTop - container.clientHeight > 24);
  };

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const container = messagesRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior });
    setShowScrollToBottom(false);
  }, []);

  useEffect(() => {
    scrollToBottom('auto');
  }, [activeConversationId, isGenerating, lastMessageId, scrollToBottom]);

  const startVoiceInput = () => {
    const SpeechRecognition = (window as typeof window & {
      webkitSpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        onresult: ((event: { results: { 0: { transcript: string } }[] }) => void) | null;
        onerror: (() => void) | null;
        start: () => void;
      };
    }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setPrompt(`${prompt}\n[Micro non disponible dans ce navigateur]`.trim());
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript;

      if (transcript) {
        setPrompt(`${prompt} ${transcript}`.trim());
      }
    };
    recognition.onerror = () => setPrompt(`${prompt}\n[Dictée interrompue]`.trim());
    recognition.start();
  };

  return (
    <aside className={isWide ? 'chat-panel wide' : 'chat-panel'}>
      <button className="resize-handle" type="button" title="Redimensionner le panneau IA" aria-label="Redimensionner le panneau IA" onPointerDown={onResizeStart} />
      <section className="panel-title">
        <Sparkles size={18} />
        <div>
          <strong>Databloom</strong>
          <span>{isGenerating ? 'Réponse en cours...' : 'Assistant data'}</span>
        </div>
        <button className={isLmConfigOpen ? 'llm-config-trigger active' : 'llm-config-trigger'} type="button" title="Configurer le LLM" onClick={onToggleLmConfig} aria-pressed={isLmConfigOpen}>
          <Settings size={15} />
          LLM
        </button>
      </section>
      {isLmConfigOpen && (
        <LlmConfigPanel
          lmConfig={lmConfig}
          onUpdateLmConfig={onUpdateLmConfig}
          onTestLmConnection={onTestLmConnection}
          isTestingLm={isTestingLm}
          lmLogs={lmLogs}
        />
      )}
      <ConversationManager
        conversations={conversations}
        activeConversationId={activeConversationId}
        activeConversationTitle={activeConversationTitle}
        canDeleteConversation={canDeleteConversation}
        onNewConversation={onNewConversation}
        onOpenConversation={onOpenConversation}
        onRenameConversation={onRenameConversation}
        onDeleteConversation={onDeleteConversation}
      />
      <div className="chat-history-actions">
        <button className="ghost-button" type="button" onClick={onRetry} disabled={isGenerating || !messages.some((message) => message.role === 'user')}>
          <RefreshCcw size={15} />
          Réessayer
        </button>
        <button className="ghost-button icon-only" type="button" title="Supprimer l'historique" aria-label="Supprimer l'historique" onClick={onClearHistory} disabled={messages.length === 0}>
          <Trash2 size={15} />
        </button>
      </div>
      <button className="chat-dataset-summary" type="button" onClick={onOpenData}>
        <Database size={22} />
        <div>
          <strong>{dataset.name}</strong>
            <span>{dataset.fields.length === 0 ? 'Ajouter une source de données' : `${dataset.fields.length} colonnes · ${dataset.rows.length.toLocaleString('fr-FR')} lignes`}</span>
        </div>
      </button>
      {datasets.length > 0 && (
        <div className="chat-dataset-picker" aria-label="Source de données active">
          <span>Travailler avec</span>
          <div>
            {datasets.map((item) => (
              <button
                key={item.id}
                className={item.id === dataset.id ? 'dataset-badge active' : 'dataset-badge'}
                type="button"
                aria-pressed={item.id === dataset.id}
                onClick={() => onSelectDataset(item.id)}
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="messages-wrap">
        <div className="messages" ref={messagesRef} onScroll={updateScrollPosition}>
          {messages.map((message) => (
            <div key={message.id} className={`message ${message.role}`}>
              {message.role === 'assistant' && <div className="message-avatar" aria-hidden="true">D</div>}
              <div className="message-content">
                {message.role === 'assistant' && <span>Databloom</span>}
                <MarkdownText text={message.text} />
              </div>
            </div>
          ))}
          {isGenerating && (
            <div className="thinking-indicator" role="status" aria-live="polite">
              <span aria-hidden="true" />
              Réflexion en cours
            </div>
          )}
        </div>
        {showScrollToBottom && (
          <button className="scroll-to-bottom" type="button" title="Aller au dernier message" aria-label="Aller au dernier message" onClick={() => scrollToBottom()}>
            <ArrowDown size={28} strokeWidth={1.8} />
          </button>
        )}
      </div>
      <div className="proposal-list">
        {pendingWidgets.map((widget) => (
          <article key={widget.id} className="proposal-card" onClick={() => onSelect(widget.id)}>
            <div>
              <span>{widget.changesetId}</span>
              <strong>{widget.title}</strong>
              <small>{widgetLabels[widget.type]} · {widget.aggregation}({widget.field})</small>
            </div>
            <div className="proposal-actions">
              <button
                type="button"
                title="Accept"
                aria-label={`Accepter le widget ${widget.title}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onAccept(widget.id);
                }}
              >
                <Check size={15} />
              </button>
              <button
                type="button"
                title="Reject"
                aria-label={`Rejeter le widget ${widget.title}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onReject(widget.id);
                }}
              >
                <X size={15} />
              </button>
            </div>
          </article>
        ))}
      </div>
      <WidgetCommandComposer
        prompt={prompt}
        setPrompt={setPrompt}
        onGenerate={onGenerate}
        isGenerating={isGenerating}
        onOpenData={onOpenData}
        assistantMode={assistantMode}
        onToggleAssistantMode={onToggleAssistantMode}
        onStartVoiceInput={startVoiceInput}
      />
    </aside>
  );
}

function MarkdownText({ text }: { text: string }) {
  const lines = text.split('\n');
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push(
      <ul key={`list-${blocks.length}`} className="message-list">
        {listItems.map((item, index) => <li key={`${item}-${index}`}>{renderInlineMarkdown(item)}</li>)}
      </ul>,
    );
    listItems = [];
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const listMatch = trimmed.match(/^[-*•]\s+(.+)/);

    if (listMatch) {
      listItems.push(listMatch[1]);
      return;
    }

    flushList();

    if (!trimmed) return;
    blocks.push(<p key={`p-${index}`}>{renderInlineMarkdown(trimmed)}</p>);
  });

  flushList();
  return <>{blocks}</>;
}

function renderInlineMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }

    return part;
  });
}
