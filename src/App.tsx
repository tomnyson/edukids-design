import React, { useState } from 'react';
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

export default function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isAdvisorOpen, setIsAdvisorOpen] = useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const { generateWebVariants, addNode, document: doc, toastMessage, setToastMessage, undo } = useDesignStore();
  const advisor = new ClaudeOpusAdvisor();

  const handleSendPrompt = async (prompt: string, model: string) => {
    setIsGenerating(true);
    try {
      // Simulate generative layout generation / AI variant synthesis
      await new Promise((resolve) => setTimeout(resolve, 600));

      // If user asks about architecture/critique, open Advisor drawer
      if (prompt.toLowerCase().includes('audit') || prompt.toLowerCase().includes('critique')) {
        setIsAdvisorOpen(true);
      } else {
        // Regenerate or add web variants to canvas
        generateWebVariants(prompt);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImportWeb = () => {
    const url = prompt('Enter website URL to import to canvas:', 'https://example.com');
    if (url) {
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
        onShare={() => alert('Share Link copied to clipboard!')}
        onConnectAgents={() => setIsConnectModalOpen(true)}
      />

      {/* Autonomous Co-Pilot Toast Notification */}
      {toastMessage && (
        <div className="absolute top-14 left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-3 bg-[#181a26]/95 backdrop-blur-md border border-emerald-500/40 text-emerald-300 px-4 py-2 rounded-xl shadow-2xl text-xs animate-in fade-in slide-in-from-top-2">
          <span>{toastMessage}</span>
          <button
            onClick={() => {
              undo();
              setToastMessage(null);
            }}
            className="bg-emerald-950 hover:bg-emerald-900 border border-emerald-700/60 text-white font-medium px-2 py-0.5 rounded text-[11px] transition"
          >
            Undo
          </button>
          <button
            onClick={() => setToastMessage(null)}
            className="text-zinc-400 hover:text-white"
          >
            &times;
          </button>
        </div>
      )}

      {/* Main Studio Viewport */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* 2. Left Agent & Document Panel */}
        {isSidebarOpen && (
          <aside className="h-full z-10 flex-shrink-0">
            <LeftSidebarContainer
              onOpenCodeModal={() => setIsCodeModalOpen(true)}
              onSendPrompt={handleSendPrompt}
              isGenerating={isGenerating}
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

        {/* Claude Opus Advisor Drawer (Flyout) */}
        <AdvisorDrawer
          isOpen={isAdvisorOpen}
          onClose={() => setIsAdvisorOpen(false)}
        />
      </div>

      {/* 5. Modals */}
      <CodePreviewModal
        isOpen={isCodeModalOpen}
        onClose={() => setIsCodeModalOpen(false)}
      />

      <PreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
      />

      <AgentConnectModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
      />
    </div>
  );
}
