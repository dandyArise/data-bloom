import { useRef, useState } from 'react';
import { ChevronDown, LoaderCircle, Mic, Send, ShieldAlert } from 'lucide-react';
import { getWidgetSlashCommands, type WidgetSlashCommand } from '../widgetCommands';

export function WidgetCommandComposer({
  prompt,
  setPrompt,
  onGenerate,
  isGenerating,
  onOpenData,
  assistantMode,
  onToggleAssistantMode,
  onStartVoiceInput,
}: {
  prompt: string;
  setPrompt: (value: string) => void;
  onGenerate: () => Promise<void>;
  isGenerating: boolean;
  onOpenData: () => void;
  assistantMode: 'Rapide' | 'Approfondi';
  onToggleAssistantMode: () => void;
  onStartVoiceInput: () => void;
}) {
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
  const [isMenuDismissed, setIsMenuDismissed] = useState(false);
  const slashQuery = prompt.startsWith('/') && !/\s/.test(prompt) ? prompt.slice(1) : null;
  const commands = slashQuery === null ? [] : getWidgetSlashCommands(slashQuery);
  const isMenuOpen = !isGenerating && !isMenuDismissed && commands.length > 0;
  const selectedCommandIndex = Math.min(activeCommandIndex, Math.max(0, commands.length - 1));

  const selectCommand = (command: WidgetSlashCommand) => {
    setPrompt(`${command.command} `);
    setActiveCommandIndex(0);
    setIsMenuDismissed(true);
    window.requestAnimationFrame(() => promptRef.current?.focus());
  };

  return (
    <div className="prompt-box">
      {isMenuOpen && (
        <section className="widget-command-menu" id="widget-command-menu" aria-label="Composants disponibles">
          <div className="widget-command-menu-header">
            <strong>Composants disponibles</strong>
            <span>{commands.length}</span>
          </div>
          <div className="widget-command-options">
            {commands.map((command, index) => (
              <button
                id={`widget-command-${command.type}`}
                key={command.type}
                className={index === selectedCommandIndex ? 'active' : ''}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectCommand(command)}
              >
                <code>{command.command}</code>
                <span>{command.label}</span>
              </button>
            ))}
          </div>
          <p id="widget-command-help">↑↓ naviguer · Entrée sélectionner · Échap fermer</p>
        </section>
      )}
      <div className="assistant-composer">
        <textarea
          ref={promptRef}
          value={prompt}
          aria-label="Message assistant"
          aria-describedby={isMenuOpen ? 'widget-command-help' : undefined}
          placeholder="Parle à Databloom, demande une analyse ou des widgets..."
          onChange={(event) => {
            setPrompt(event.target.value);
            setActiveCommandIndex(0);
            setIsMenuDismissed(false);
          }}
          onKeyDown={(event) => {
            if (isMenuOpen && event.key === 'ArrowDown') {
              event.preventDefault();
              setActiveCommandIndex((current) => (current + 1) % commands.length);
              return;
            }
            if (isMenuOpen && event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveCommandIndex((current) => (current - 1 + commands.length) % commands.length);
              return;
            }
            if (isMenuOpen && event.key === 'Escape') {
              event.preventDefault();
              setIsMenuDismissed(true);
              return;
            }
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              const selectedCommand = commands[selectedCommandIndex];
              if (isMenuOpen && selectedCommand && prompt.trim() !== selectedCommand.command) {
                selectCommand(selectedCommand);
                return;
              }
              void onGenerate();
            }
          }}
        />
        <div className="composer-tools">
          <button className="access-button" type="button" onClick={onOpenData}>
            <ShieldAlert size={20} />
            Sources
          </button>
          <button className="mode-button" type="button" onClick={onToggleAssistantMode}>
            {isGenerating ? <LoaderCircle className="spin" size={20} /> : <span className="mode-dot" />}
            {assistantMode}
            <ChevronDown size={15} />
          </button>
          <button className="composer-icon-button" type="button" title="Dicter" aria-label="Dicter le message" onClick={onStartVoiceInput} disabled={isGenerating}>
            <Mic size={18} />
          </button>
        </div>
        <button className="send-circle" type="button" title="Envoyer" aria-label="Envoyer le message" onClick={() => void onGenerate()} disabled={isGenerating || !prompt.trim()}>
          <Send size={22} />
        </button>
      </div>
    </div>
  );
}
