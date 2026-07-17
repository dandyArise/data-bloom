import { useState } from 'react';
import { ChatPanel } from './components/ChatPanel';
import { CodePanel } from './components/CodePanel';
import { BoardCanvas, StageHeader } from './components/DashboardView';
import { DataSourcesView } from './components/DataSourcesView';
import { Inspector } from './components/Inspector';
import { LlmConfigPanel } from './components/LlmConfigPanel';
import { NavigationRail } from './components/NavigationRail';
import { ConversationManager } from './components/ConversationManager';
import { AppTopBar } from './components/layout/AppTopBar';
import { DataGridView } from './components/tables/DataGridView';
import { useDataBloomController } from './hooks/useDataBloomController';
import { useTheme } from './hooks/useTheme';

export default function App() {
  const [isConversationsOpen, setIsConversationsOpen] = useState(false);
  const { theme, toggleTheme, palette, setPalette } = useTheme();
  const { isPresentationMode, pendingWidgets, resetBoard, togglePresentationMode, workspaceColumns, showNav, viewMode, setViewMode, isChatOpen, isInspectorOpen, setIsChatOpen, setIsInspectorOpen, showChat, conversations, activeConversation, createNewConversation, openConversation, renameConversation, deleteConversation, messages, dataset, llmDataset, datasets, selectDataset, selectLmDataset, prompt, setPrompt, generate, retryLastTurn, clearConversation, isGenerating, lmConfig, updateLmConfig, isLmConfigOpen, setIsLmConfigOpen, testLmConnection, isTestingLm, lmLogs, assistantMode, setAssistantMode, startChatResize, chatPanelWidth, acceptWidget, rejectWidget, selectWidget, activeWidgets, selectedId, updateWidget, deleteWidget, acceptedWidgets, isImporting, importError, renameDataset, deleteDataset, importDataset, setGridQualityFilter, removeDuplicateRows, connectApiDataset, connectMonitorDataset, checkMonitorDataset, gridQualityFilter, uiJson, workflowYaml, showInspector, selectedWidget, selectedWidgetDataset, dashboardTitle } = useDataBloomController();
  return (
    <div className={isPresentationMode ? 'app-shell presentation-mode' : 'app-shell'}>
      <AppTopBar
        pendingCount={pendingWidgets.length}
        theme={theme}
        palette={palette}
        onReset={resetBoard}
        onToggleTheme={toggleTheme}
        onPaletteChange={setPalette}
        isPresentationMode={isPresentationMode}
        onTogglePresentation={() => { setIsConversationsOpen(false); togglePresentationMode(); }}
      />
      <div className="workspace" style={{ gridTemplateColumns: workspaceColumns }}>
        {showNav && (
          <NavigationRail
            viewMode={viewMode}
            setViewMode={setViewMode}
             isChatOpen={isChatOpen}
             isConversationsOpen={isConversationsOpen}
            isInspectorOpen={isInspectorOpen}
            isLmConfigOpen={isLmConfigOpen}
             onToggleChat={() => setIsChatOpen((current) => !current)}
             onToggleConversations={() => { setIsInspectorOpen(false); setIsLmConfigOpen(false); setIsConversationsOpen((current) => !current); }}
            onToggleInspector={() => { setIsConversationsOpen(false); setIsInspectorOpen((current) => !current); }}
            onToggleLmConfig={() => { setIsConversationsOpen(false); setIsInspectorOpen(false); setIsLmConfigOpen((current) => !current); }}
          />
         )}
        {isConversationsOpen && !isPresentationMode && (
          <>
            <button className="conversation-drawer-backdrop" type="button" aria-label="Fermer les discussions" onClick={() => setIsConversationsOpen(false)} />
            <aside className="conversation-drawer" aria-label="Discussions et boards">
              <ConversationManager
                conversations={conversations}
                activeConversationId={activeConversation?.id ?? ''}
                activeConversationTitle={activeConversation?.title ?? ''}
                canDeleteConversation={conversations.length > 1 || messages.length > 0 || activeWidgets.length > 0}
                onNewConversation={createNewConversation}
                onOpenConversation={openConversation}
                onRenameConversation={renameConversation}
                onDeleteConversation={deleteConversation}
                onClose={() => setIsConversationsOpen(false)}
              />
            </aside>
          </>
        )}
        {showChat && (
          <ChatPanel
            activeConversationId={activeConversation?.id ?? ''}
            messages={messages}
            llmDataset={llmDataset}
            datasets={datasets}
            onSelectLmDataset={selectLmDataset}
            pendingWidgets={pendingWidgets}
            prompt={prompt}
            setPrompt={setPrompt}
            onGenerate={generate}
            onRetry={retryLastTurn}
            onClearHistory={clearConversation}
            mode={{
              generation: isGenerating ? 'generating' : 'idle',
              layout: chatPanelWidth >= 560 ? 'wide' : 'standard',
            }}
            onOpenGrid={() => setViewMode('grid')}
            onOpenData={() => setViewMode('data')}
            assistantMode={assistantMode}
            onToggleAssistantMode={() => setAssistantMode((current) => (current === 'Approfondi' ? 'Rapide' : 'Approfondi'))}
            onResizeStart={startChatResize}
            onAccept={acceptWidget}
            onReject={rejectWidget}
            onSelect={selectWidget}
          />
        )}
        <main className="main-stage">
          <StageHeader
            title={dashboardTitle}
            viewMode={viewMode}
            setViewMode={setViewMode}
            acceptedCount={acceptedWidgets.length}
            pendingCount={pendingWidgets.length}
          />
          {viewMode === 'board' && (
            <BoardCanvas
              widgets={activeWidgets}
              datasets={datasets}
              selectedId={selectedId}
              onSelect={selectWidget}
              onUpdate={updateWidget}
              onDelete={deleteWidget}
              onAccept={acceptWidget}
              onReject={rejectWidget}
            />
          )}
          {viewMode === 'data' && (
            <DataSourcesView
              dataset={dataset}
              datasets={datasets}
              isImporting={isImporting}
              importError={importError}
              onSelectDataset={selectDataset}
              onRenameDataset={renameDataset}
              onDeleteDataset={deleteDataset}
              onImportDataset={importDataset}
              onOpenGrid={() => { setGridQualityFilter(null); setViewMode('grid'); }}
              onReviewQualityIssue={(issue) => { setGridQualityFilter(issue); setViewMode('grid'); }}
              onRemoveDuplicateRows={removeDuplicateRows}
              onConnectApi={connectApiDataset}
              onConnectMonitor={connectMonitorDataset}
              onCheckMonitor={checkMonitorDataset}
            />
          )}
          {viewMode === 'grid' && <DataGridView dataset={dataset} qualityFilter={gridQualityFilter} onClearQualityFilter={() => setGridQualityFilter(null)} />}
          {viewMode === 'json' && <CodePanel title="ui.json" value={JSON.stringify(uiJson, null, 2)} />}
          {viewMode === 'workflow' && <CodePanel title="workflow.yml" value={workflowYaml} />}
        </main>
        {showInspector && (
            <Inspector
              widget={selectedWidget}
              dataset={selectedWidgetDataset}
            onUpdate={updateWidget}
            onClose={() => setIsInspectorOpen(false)}
          />
        )}
        {isLmConfigOpen && !isPresentationMode && (
          <aside className="llm-config-drawer" aria-label="Configuration LLM">
            <LlmConfigPanel lmConfig={lmConfig} onUpdateLmConfig={updateLmConfig} onTestLmConnection={testLmConnection} isTestingLm={isTestingLm} lmLogs={lmLogs} />
          </aside>
        )}
      </div>
    </div>
  );
}
