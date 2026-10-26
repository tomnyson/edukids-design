import React, { useState } from 'react';
import { TopNavbar } from './components/toolbar/TopNavbar';
import { LayerTree } from './components/sidebar/LayerTree';
import { InfiniteCanvas } from './components/canvas/InfiniteCanvas';
import { PropertiesInspector } from './components/sidebar/PropertiesInspector';
import { CodePreviewModal } from './components/panels/CodePreviewModal';
import { AdvisorDrawer } from './components/advisor/AdvisorDrawer';

export default function App() {
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const [isAdvisorOpen, setIsAdvisorOpen] = useState(true); // Open by default for immediate discoverability

  return (
    <div className="flex h-screen w-screen flex-col bg-zinc-950 text-zinc-100 font-sans overflow-hidden select-none">
      {/* Top Navbar */}
      <TopNavbar
        onToggleCodeModal={() => setIsCodeModalOpen(true)}
        onToggleAdvisor={() => setIsAdvisorOpen((prev) => !prev)}
        isAdvisorOpen={isAdvisorOpen}
      />

      {/* Main Studio Viewport */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left: Layer Hierarchy Tree */}
        <aside className="w-64 flex-shrink-0 h-full">
          <LayerTree />
        </aside>

        {/* Center: Infinite Canvas Viewport */}
        <main className="flex-1 h-full relative">
          <InfiniteCanvas />
        </main>

        {/* Right: Properties Inspector */}
        <aside className="w-72 flex-shrink-0 h-full">
          <PropertiesInspector />
        </aside>

        {/* Claude Opus Advisor Drawer */}
        <AdvisorDrawer
          isOpen={isAdvisorOpen}
          onClose={() => setIsAdvisorOpen(false)}
        />
      </div>

      {/* Bidirectional Code Sync Modal */}
      <CodePreviewModal
        isOpen={isCodeModalOpen}
        onClose={() => setIsCodeModalOpen(false)}
      />
    </div>
  );
}
