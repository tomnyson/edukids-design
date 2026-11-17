import React, { useState, useEffect, useCallback } from 'react';
import { WindowChrome } from './components/layout/WindowChrome';
import { LeftSidebarContainer } from './components/layout/LeftSidebarContainer';
import { FloatingToolDock } from './components/toolbar/FloatingToolDock';
import { InfiniteCanvas } from './components/canvas/InfiniteCanvas';
import { PropertiesInspector } from './components/sidebar/PropertiesInspector';
import { CodePreviewModal } from './components/panels/CodePreviewModal';
import { PreviewModal } from './components/modals/PreviewModal';
import { AdvisorDrawer } from './components/advisor/AdvisorDrawer';
import { AgentConnectModal } from './components/modals/AgentConnectModal';
import { useDesignStore } from './store/useDesignStore';
import { ClaudeOpusAdvisor } from './advisor/ClaudeOpusAdvisor';
import { useFileActions } from './hooks/useFileActions';
import { useDesignGeneration } from './hooks/useDesignGeneration';
import { useAgentChatStore } from './store/useAgentChatStore';
import { runAgentTurn } from './lib/agent-turn';
import { readSharedDocument, SHARE_HASH_PREFIX } from './lib/share-link';
import { notify } from './lib/toast';
import { HomeScreen } from './components/home/HomeScreen';
import { readImageFile } from './lib/image-source';

/** Sent with a screenshot from Home's "Recreate a screenshot" */
const RECREATE_PROMPT =
  'Recreate the attached screenshot as an editable design: match its layout, spacing, colors, typography and text as closely as possible.';

export default function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isAdvisorOpen, setIsAdvisorOpen] = useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isAdvisorKeySetup, setIsAdvisorKeySetup] = useState(false);

  const { addNode, document: doc, toastMessage, setToastMessage, undo, view } = useDesignStore();
  const advisor = new ClaudeOpusAdvisor();
  const fileActions = useFileActions();
  const openApiKeySetup = useCallback(() => {
    setIsAdvisorKeySetup(true);
    setIsAdvisorOpen(true);
  }, []);
  const designGeneration = useDesignGeneration(openApiKeySetup);

  // File shortcuts: Cmd/Ctrl + N (new tab), O (open), S (save), Shift+S (save as)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key === 'n') {
        e.preventDefault();
        fileActions.newDocument();
      } else if (key === 'o') {
        e.preventDefault();
        fileActions.openFile();
      } else if (key === 's') {
        e.preventDefault();
        if (e.shiftKey) fileActions.saveFileAs();
        else fileActions.saveFile();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [fileActions]);

  // Opening a share link imports its design into a new tab and previews it
  useEffect(() => {
    const openSharedLink = async () => {
      const { hash } = window.location;
      if (!hash.startsWith(`#${SHARE_HASH_PREFIX}`)) return;
      // Cleared before the async decode so a repeated effect/hashchange never imports twice;
      // the design then lives in a tab, not in the address bar or history
      history.replaceState(null, '', window.location.pathname + window.location.search);
      try {
        const shared = await readSharedDocument(hash);
        if (!shared) return;
        useDesignStore.getState().loadDocument(shared, 'shared.pen');
        setIsPreviewOpen(true);
      } catch (err) {
        notify(`⚠️ Link chia sẻ bị hỏng: ${err instanceof Error ? err.message : 'không đọc được'}`);
      }
    };
    void openSharedLink();
    window.addEventListener('hashchange', openSharedLink);
    return () => window.removeEventListener('hashchange', openSharedLink);
  }, []);

  // Warn before leaving the page while any tab has unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const { isDirty, tabs, activeTabId } = useDesignStore.getState();
      if (isDirty || tabs.some((t) => t.id !== activeTabId && t.isDirty)) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Each prompt and its outcome are recorded in the active agent chat
  const handleSendPrompt = (prompt: string, model: string): Promise<boolean> =>
    runAgentTurn(prompt, model, {
      chat: useAgentChatStore.getState(),
      generate: designGeneration.generate,
      openAdvisor: () => setIsAdvisorOpen(true),
    });

  // Home: the design goes to a blank tab, reusing the untouched one when there is one
  const handleCreateFromHome = (prompt: string, model: string): Promise<boolean> => {
    useDesignStore.getState().startBlankDesign();
    return handleSendPrompt(prompt, model);
  };

  const handleRecreateScreenshot = async (file: File) => {
    let src: string;
    try {
      src = await readImageFile(file);
    } catch (err) {
      notify(`⚠️ ${err instanceof Error ? err.message : 'Không đọc được ảnh.'}`);
      return;
    }
    const store = useDesignStore.getState();
    store.startBlankDesign();
    store.addContextAttachment({ id: `screenshot-${Date.now()}`, type: 'image', name: file.name, previewUrl: src });
    await handleSendPrompt(RECREATE_PROMPT, store.selectedModel);
  };

  const handleImportWeb = () => {
    const url = prompt('Enter website URL to import to canvas:', 'https://example.com');
    if (url) {
      if (useDesignStore.getState().view === 'home') useDesignStore.getState().startBlankDesign();
      addNode({
        type: 'frame',
        name: `Import: ${url}`,
        x: 400,
        y: 80,
        width: 380,
        height: 600,
        fill: '#0f111a',
        cornerRadius: 12,
        stroke: '#38bdf8',
        strokeWidth: 1,
        layout: 'flex',
        flexDirection: 'column',
        padding: 16,
        gap: 12,
      });
    }
  };

  return (
    <div className="flex h-screen w-screen flex-col bg-[#0c0d12] text-zinc-100 font-sans overflow-hidden select-none">
      {/* 1. macOS Window Chrome & Top Navbar */}
      <WindowChrome
        onPlayPreview={() => setIsPreviewOpen(true)}
        onImportWeb={handleImportWeb}
        onShare={fileActions.copyShareLink}
        onConnectAgents={() => setIsConnectModalOpen(true)}
        fileActions={fileActions}
      />

      {/* Autonomous Co-Pilot Toast Notification */}
      {toastMessage && (
        <div className="absolute top-14 left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-3 bg-[#181a26]/95 backdrop-blur-md border border-emerald-500/40 text-emerald-300 px-4 py-2 rounded-xl shadow-2xl text-xs animate-in fade-in slide-in-from-top-2">
          <span>{toastMessage}</span>
          {/* Undo only makes sense for toasts announcing an Advisor auto-edit */}
          {toastMessage.startsWith('🤖') && (
            <button
              onClick={() => {
                undo();
                setToastMessage(null);
              }}
              className="bg-emerald-950 hover:bg-emerald-900 border border-emerald-700/60 text-white font-medium px-2 py-0.5 rounded text-[11px] transition"
            >
              Undo
            </button>
          )}
          <button onClick={() => setToastMessage(null)} className="text-zinc-400 hover:text-white">
            &times;
          </button>
        </div>
      )}

      {/* Main Studio Viewport */}
      <div className="flex flex-1 overflow-hidden relative">
        {view === 'home' ? (
          <HomeScreen
            onCreate={handleCreateFromHome}
            isGenerating={designGeneration.isGenerating}
            onImportBrowser={handleImportWeb}
            onRecreateScreenshot={(file) => void handleRecreateScreenshot(file)}
            onOpenRecent={fileActions.openRecent}
          />
        ) : (
          <>
            {/* 2. Left Agent & Document Panel */}
            {isSidebarOpen && (
              <aside className="h-full z-10 flex-shrink-0">
                <LeftSidebarContainer
                  onOpenCodeModal={() => setIsCodeModalOpen(true)}
                  onSendPrompt={handleSendPrompt}
                  isGenerating={designGeneration.isGenerating}
                  onOpenBrowserImport={handleImportWeb}
                />
              </aside>
            )}

            {/* 3. Central Canvas Viewport */}
            <main className="flex-1 h-full relative overflow-hidden">
              {/* Floating Vertical Tool Dock */}
              <FloatingToolDock
                onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
                onOpenBrowserImport={handleImportWeb}
                onOpenComponents={() => setIsCodeModalOpen(true)}
              />

              {/* Infinite Canvas */}
              <InfiniteCanvas />
            </main>

            {/* 4. Right Properties Inspector / Advisor */}
            <aside className="w-72 flex-shrink-0 h-full hidden lg:block">
              <PropertiesInspector />
            </aside>
          </>
        )}

        {/* Claude Opus Advisor Drawer (Flyout) */}
        <AdvisorDrawer
          isOpen={isAdvisorOpen}
          showKeySetup={isAdvisorKeySetup}
          onClose={() => {
            setIsAdvisorOpen(false);
            setIsAdvisorKeySetup(false);
          }}
        />
      </div>

      {/* 5. Modals */}
      <CodePreviewModal isOpen={isCodeModalOpen} onClose={() => setIsCodeModalOpen(false)} />

      <PreviewModal isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} />

      <AgentConnectModal isOpen={isConnectModalOpen} onClose={() => setIsConnectModalOpen(false)} />
    </div>
  );
}
