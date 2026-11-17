import React, { useState } from 'react';
import {
  PanelLeftClose,
  MousePointer,
  Frame,
  Square,
  Circle,
  Type,
  PenTool,
  Crop,
  StickyNote,
  Globe,
  MessageCircle,
  Component,
  Image as ImageIcon,
  MoreHorizontal,
} from 'lucide-react';
import { ToolType, useDesignStore } from '../../store/useDesignStore';
import { ImageInsertPopover } from '../popovers/ImageInsertPopover';

/** Tools that are planned but not built yet: visible, dimmed and inert */
const COMING_SOON_CLASS = 'p-2 rounded-xl text-zinc-600 opacity-50 cursor-not-allowed';

interface FloatingToolDockProps {
  onToggleSidebar: () => void;
  onOpenBrowserImport: () => void;
  onOpenComponents: () => void;
}

export const FloatingToolDock: React.FC<FloatingToolDockProps> = ({
  onToggleSidebar,
  onOpenBrowserImport,
  onOpenComponents,
}) => {
  const { activeTool, setActiveTool } = useDesignStore();
  const [isImageOpen, setIsImageOpen] = useState(false);

  const handleToolClick = (tool: ToolType) => {
    setActiveTool(tool);
  };

  return (
    <div className="absolute top-4 left-4 z-20 flex flex-col items-center gap-1 p-1 bg-[#161722]/90 backdrop-blur-md border border-[#2a2c3d] rounded-2xl shadow-2xl select-none">
      {/* 1. Toggle Sidebar */}
      <button
        onClick={onToggleSidebar}
        className="p-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-[#202232] transition"
        title="Toggle Sidebar"
      >
        <PanelLeftClose className="h-4 w-4" />
      </button>

      <div className="h-[1px] w-5 bg-[#2a2c3d] my-0.5" />

      {/* 2. Pointer / Select */}
      <button
        onClick={() => handleToolClick('select')}
        className={`p-2 rounded-xl transition ${
          activeTool === 'select'
            ? 'bg-[#252738] text-white shadow-sm'
            : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#202232]'
        }`}
        title="Select (V)"
      >
        <MousePointer className="h-4 w-4" />
      </button>

      {/* 3. Frame */}
      <button
        onClick={() => handleToolClick('frame')}
        className={`p-2 rounded-xl transition ${
          activeTool === 'frame'
            ? 'bg-[#252738] text-orange-400 shadow-sm'
            : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#202232]'
        }`}
        title="Frame (F)"
      >
        <Frame className="h-4 w-4" />
      </button>

      {/* 4. Rectangle */}
      <button
        onClick={() => handleToolClick('rect')}
        className={`p-2 rounded-xl transition ${
          activeTool === 'rect'
            ? 'bg-[#252738] text-orange-400 shadow-sm'
            : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#202232]'
        }`}
        title="Rectangle (R)"
      >
        <Square className="h-4 w-4" />
      </button>

      {/* 5. Ellipse */}
      <button
        onClick={() => handleToolClick('ellipse')}
        className={`p-2 rounded-xl transition ${
          activeTool === 'ellipse'
            ? 'bg-[#252738] text-orange-400 shadow-sm'
            : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#202232]'
        }`}
        title="Ellipse (O)"
      >
        <Circle className="h-4 w-4" />
      </button>

      {/* 6. Text */}
      <button
        onClick={() => handleToolClick('text')}
        className={`p-2 rounded-xl transition ${
          activeTool === 'text'
            ? 'bg-[#252738] text-blue-400 shadow-sm'
            : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#202232]'
        }`}
        title="Text (T)"
      >
        <Type className="h-4 w-4" />
      </button>

      {/* 7. Pen Vector */}
      <button
        disabled
        aria-disabled="true"
        className={COMING_SOON_CLASS}
        title="Pen Vector Tool (sắp có)"
      >
        <PenTool className="h-4 w-4" />
      </button>

      {/* 8. Crop */}
      <button
        disabled
        aria-disabled="true"
        className={COMING_SOON_CLASS}
        title="Crop (sắp có)"
      >
        <Crop className="h-4 w-4" />
      </button>

      {/* 9. Sticky Note */}
      <button
        disabled
        aria-disabled="true"
        className={COMING_SOON_CLASS}
        title="Sticky Note / Comment Card (sắp có)"
      >
        <StickyNote className="h-4 w-4" />
      </button>

      {/* 10. Web Browser Import */}
      <button
        onClick={onOpenBrowserImport}
        className="p-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-[#202232] transition"
        title="Import Web Page to Canvas"
      >
        <Globe className="h-4 w-4" />
      </button>

      {/* 11. Comments */}
      <button
        disabled
        aria-disabled="true"
        className={COMING_SOON_CLASS}
        title="Comments (sắp có)"
      >
        <MessageCircle className="h-4 w-4" />
      </button>

      {/* 12. Component Library */}
      <button
        onClick={onOpenComponents}
        className="p-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-[#202232] transition"
        title="Component Library"
      >
        <Component className="h-4 w-4" />
      </button>

      {/* 13. Image / Media */}
      <div className="relative">
        <button
          data-image-insert-trigger
          onClick={() => setIsImageOpen((open) => !open)}
          aria-expanded={isImageOpen}
          className={`p-2 rounded-xl transition ${
            isImageOpen
              ? 'bg-[#252738] text-orange-400 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#202232]'
          }`}
          title="Insert Image"
        >
          <ImageIcon className="h-4 w-4" />
        </button>
        <ImageInsertPopover isOpen={isImageOpen} onClose={() => setIsImageOpen(false)} />
      </div>

      {/* 14. More */}
      <button
        disabled
        aria-disabled="true"
        className={COMING_SOON_CLASS}
        title="More Tools (sắp có)"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
    </div>
  );
};
