import React from 'react';
import {
  PanelLeftClose,
  MousePointer,
  Frame,
  Square,
  Diamond,
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

      {/* 5. Diamond / Shape */}
      <button
        onClick={() => handleToolClick('rect')}
        className="p-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-[#202232] transition"
        title="Diamond / Polygon"
      >
        <Diamond className="h-4 w-4" />
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
        className="p-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-[#202232] transition"
        title="Pen Vector Tool (P)"
      >
        <PenTool className="h-4 w-4" />
      </button>

      {/* 8. Crop */}
      <button
        className="p-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-[#202232] transition"
        title="Crop"
      >
        <Crop className="h-4 w-4" />
      </button>

      {/* 9. Sticky Note */}
      <button
        className="p-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-[#202232] transition"
        title="Sticky Note / Comment Card"
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
        className="p-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-[#202232] transition"
        title="Comments (C)"
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
      <button
        className="p-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-[#202232] transition"
        title="Insert Media"
      >
        <ImageIcon className="h-4 w-4" />
      </button>

      {/* 14. More */}
      <button
        className="p-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-[#202232] transition"
        title="More Tools"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
    </div>
  );
};
