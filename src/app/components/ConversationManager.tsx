import { useState } from 'react';
import { MessageSquare, Plus, Trash2 } from 'lucide-react';
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
}: ConversationManagerProps) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId);
  const messageCount = activeConversation?.messages.length ?? 0;

  return (
    <div className="conversation-manager">
      <div className="conversation-toolbar">
        <MessageSquare size={22} />
        <div className="conversation-heading">
          <input
            className="conversation-title-input"
            aria-label="Renommer la discussion"
            value={activeConversationTitle}
            onChange={(event) => onRenameConversation(activeConversationId, event.target.value)}
          />
          <span>{conversations.length} discussion{conversations.length > 1 ? 's' : ''} · {messageCount} message{messageCount > 1 ? 's' : ''}</span>
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
      </div>
      {conversations.length > 1 && (
        <select className="conversation-switcher" value={activeConversationId} onChange={(event) => onOpenConversation(event.target.value)} aria-label="Ouvrir une discussion">
          {conversations.map((conversation) => (
            <option key={conversation.id} value={conversation.id}>
              {conversation.title || 'Sans titre'}
            </option>
          ))}
        </select>
      )}
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
