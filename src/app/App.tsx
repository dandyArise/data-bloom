import { ChatPanel } from './components/ChatPanel';
import { CodePanel } from './components/CodePanel';
import { BoardCanvas, StageHeader } from './components/DashboardView';
import { DataSourcesView } from './components/DataSourcesView';
import { Inspector } from './components/Inspector';
import { NavigationRail } from './components/NavigationRail';
import { AppTopBar } from './components/layout/AppTopBar';
import { DataGridView } from './components/tables/DataGridView';
import { useDataBloomController } from './hooks/useDataBloomController';
import { useTheme } from './hooks/useTheme';

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const { isPresentationMode, pendingWidgets, resetBoard, togglePresentationMode, workspaceColumns, showNav, viewMode, setViewMode, isChatOpen, isInspectorOpen, setIsChatOpen, setIsInspectorOpen, showChat, conversations, activeConversation, createNewConversation, openConversation, renameConversation, deleteConversation, messages, dataset, datasets, selectDataset, prompt, setPrompt, generate, retryLastTurn, clearConversation, isGenerating, lmConfig, updateLmConfig, isLmConfigOpen, setIsLmConfigOpen, testLmConnection, isTestingLm, lmLogs, assistantMode, setAssistantMode, startChatResize, chatPanelWidth, acceptWidget, rejectWidget, selectWidget, activeWidgets, selectedId, updateWidget, deleteWidget, acceptedWidgets, isImporting, importError, renameDataset, deleteDataset, importDataset, setGridQualityFilter, removeDuplicateRows, connectApiDataset, connectMonitorDataset, checkMonitorDataset, gridQualityFilter, uiJson, workflowYaml, showInspector, selectedWidget, dashboardTitle } = useDataBloomController();
  return (
    <div className={isPresentationMode ? 'app-shell presentation-mode' : 'app-shell'}>
      <AppTopBar
        pendingCount={pendingWidgets.length}
        theme={theme}
        onReset={resetBoard}
        onToggleTheme={toggleTheme}
        isPresentationMode={isPresentationMode}
        onTogglePresentation={togglePresentationMode}
      />
      <div className="workspace" style={{ gridTemplateColumns: workspaceColumns }}>
        {showNav && (
          <NavigationRail
            viewMode={viewMode}
            setViewMode={setViewMode}
            isChatOpen={isChatOpen}
            isInspectorOpen={isInspectorOpen}
            onToggleChat={() => setIsChatOpen((current) => !current)}
            onToggleInspector={() => setIsInspectorOpen((current) => !current)}
          />
        )}
        {showChat && (
          <ChatPanel
            conversations={conversations}
            activeConversationId={activeConversation?.id ?? ''}
            activeConversationTitle={activeConversation?.title ?? ''}
            onNewConversation={createNewConversation}
            onOpenConversation={openConversation}
            onRenameConversation={renameConversation}
            onDeleteConversation={deleteConversation}
            messages={messages}
            dataset={dataset}
            datasets={datasets}
            onSelectDataset={selectDataset}
            pendingWidgets={pendingWidgets}
            activeWidgetCount={activeWidgets.length}
            prompt={prompt}
            setPrompt={setPrompt}
            onGenerate={generate}
            onRetry={retryLastTurn}
            onClearHistory={clearConversation}
            mode={{
              generation: isGenerating ? 'generating' : 'idle',
              configuration: isLmConfigOpen ? 'open' : 'closed',
              connectionTest: isTestingLm ? 'testing' : 'idle',
              layout: chatPanelWidth >= 560 ? 'wide' : 'standard',
            }}
            lmConfig={lmConfig}
            onUpdateLmConfig={updateLmConfig}
            onToggleLmConfig={() => setIsLmConfigOpen((current) => !current)}
            onTestLmConnection={testLmConnection}
            lmLogs={lmLogs}
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
              dataset={dataset}
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
            dataset={dataset}
            onUpdate={updateWidget}
            onClose={() => setIsInspectorOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
