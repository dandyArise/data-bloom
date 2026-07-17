import { useState } from 'react';
import { LayoutDashboard, MessageSquare, Plus, Trash2, X } from 'lucide-react';
import type { Conversation } from '../appState';

type ConversationManagerProps = {
  conversations: Conversation[];
  activeConversationId: string;
  activeConversationTitle: string;
  canDeleteConversation: boolean;
  onNewConversation: () => void;
  onOpenConversation: (id: string) => void;
  onRenameConversation: (id: string, title: string) => void;
  onDeleteConversation: (id: string) => void;
  onClose?: () => void;
};

export function ConversationManager({
  conversations,
  activeConversationId,
  activeConversationTitle,
  canDeleteConversation,
  onNewConversation,
  onOpenConversation,
  onRenameConversation,
  onDeleteConversation,
  onClose,
}: ConversationManagerProps) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId);

  return (
    <div className="conversation-manager">
      <div className="conversation-toolbar">
        <MessageSquare size={22} />
        <div className="conversation-heading">
          <strong>Discussions</strong>
          <span>{conversations.length} board{conversations.length > 1 ? 's' : ''} indépendant{conversations.length > 1 ? 's' : ''}</span>
        </div>
        <button className="ghost-button icon-only" type="button" title="Nouvelle discussion" aria-label="Nouvelle discussion" onClick={onNewConversation}>
          <Plus size={20} />
        </button>
        <button
          className="ghost-button icon-only"
          type="button"
          title="Supprimer la discussion"
          aria-label="Supprimer la discussion"
          onClick={() => setIsConfirmingDelete(true)}
          disabled={!activeConversationId || !canDeleteConversation}
        >
          <Trash2 size={20} />
        </button>
        {onClose && (
          <button className="ghost-button icon-only" type="button" title="Fermer les discussions" aria-label="Fermer les discussions" onClick={onClose}>
            <X size={20} />
          </button>
        )}
      </div>
      <div className="conversation-tabs" role="tablist" aria-label="Chats et boards">
        {conversations.map((conversation) => {
          const activeWidgetCount = conversation.widgets.filter((widget) => widget.status !== 'rejected').length;
          return <button key={conversation.id} className={conversation.id === activeConversationId ? 'conversation-tab active' : 'conversation-tab'} type="button" role="tab" aria-selected={conversation.id === activeConversationId} onClick={() => onOpenConversation(conversation.id)}>
            <span>{conversation.title || 'Sans titre'}</span>
            <small><LayoutDashboard size={13} />{activeWidgetCount} widget{activeWidgetCount > 1 ? 's' : ''} · {conversation.messages.length} msg</small>
          </button>;
        })}
      </div>
      <label className="conversation-title-field">
        <span>Nom du chat et du board</span>
        <input
          className="conversation-title-input"
          aria-label="Renommer le chat et le board"
          value={activeConversationTitle}
          onChange={(event) => onRenameConversation(activeConversationId, event.target.value)}
        />
      </label>
      {isConfirmingDelete && canDeleteConversation && (
        <div className="confirm-delete-row">
          <span>Supprimer cette discussion ?</span>
          <button className="danger-button" type="button" onClick={() => { onDeleteConversation(activeConversationId); setIsConfirmingDelete(false); }}>
            Supprimer
          </button>
          <button className="ghost-button" type="button" onClick={() => setIsConfirmingDelete(false)}>
            Annuler
          </button>
        </div>
      )}
    </div>
  );
}
