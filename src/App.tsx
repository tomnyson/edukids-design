import React, { useState } from 'react';
import { WindowChrome } from './components/layout/WindowChrome';
import { LeftSidebarContainer } from './components/layout/LeftSidebarContainer';
import { FloatingToolDock } from './components/toolbar/FloatingToolDock';
import { InfiniteCanvas } from './components/canvas/InfiniteCanvas';
import { PropertiesInspector } from './components/sidebar/PropertiesInspector';
import { CodePreviewModal } from './components/panels/CodePreviewModal';
import { PreviewModal } from './components/modals/PreviewModal';
import { AdvisorDrawer } from './components/advisor/AdvisorDrawer';
import { useDesignStore } from './store/useDesignStore';
import { ClaudeOpusAdvisor } from './advisor/ClaudeOpusAdvisor';

export default function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isAdvisorOpen, setIsAdvisorOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const { generateWebVariants, addNode, document: doc } = useDesignStore();
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
      />

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
    </div>
  );
}
