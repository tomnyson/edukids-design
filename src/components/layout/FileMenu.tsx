import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, FilePlus, FolderOpen, Save, SaveAll, FileJson, FileCode2, FileType2, FileImage, FileDown } from 'lucide-react';
import { FileActions } from '../../hooks/useFileActions';

interface FileMenuProps {
  actions: FileActions;
}

interface MenuItem {
  label: string;
  shortcut?: string;
  icon: React.ReactNode;
  run: () => void;
  dividerBefore?: boolean;
}

export const FileMenu: React.FC<FileMenuProps> = ({ actions }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setIsOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const items: MenuItem[] = [
    { label: 'New Tab', icon: <FilePlus className="h-3.5 w-3.5" />, run: actions.newDocument },
    { label: 'Open…', shortcut: '⌘O', icon: <FolderOpen className="h-3.5 w-3.5" />, run: actions.openFile },
    { label: 'Save', shortcut: '⌘S', icon: <Save className="h-3.5 w-3.5" />, run: actions.saveFile, dividerBefore: true },
    { label: 'Save As…', shortcut: '⇧⌘S', icon: <SaveAll className="h-3.5 w-3.5" />, run: actions.saveFileAs },
    { label: 'Export .pen', icon: <FileJson className="h-3.5 w-3.5" />, run: actions.exportPen, dividerBefore: true },
    { label: 'Export React (.tsx)', icon: <FileCode2 className="h-3.5 w-3.5" />, run: actions.exportJsx },
    { label: 'Export HTML', icon: <FileType2 className="h-3.5 w-3.5" />, run: actions.exportHtml },
    { label: 'Export PNG', icon: <FileImage className="h-3.5 w-3.5" />, run: actions.exportPng, dividerBefore: true },
    { label: 'Export PDF', icon: <FileDown className="h-3.5 w-3.5" />, run: actions.exportPdf },
  ];

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition ${
          isOpen ? 'bg-[#1b1c26] text-zinc-100' : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#161720]'
        }`}
      >
        <span>File</span>
        <ChevronDown className="h-3 w-3" />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute left-0 top-full mt-1.5 z-50 w-56 rounded-lg border border-[#2b2d3d] bg-[#14151d]/98 p-1 shadow-2xl shadow-black/60 backdrop-blur-md"
        >
          {items.map((item) => (
            <React.Fragment key={item.label}>
              {item.dividerBefore && <div className="my-1 h-px bg-[#232533]" />}
              <button
                role="menuitem"
                onClick={() => {
                  setIsOpen(false);
                  item.run();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-zinc-300 hover:bg-[#1f2130] hover:text-zinc-100 focus-visible:bg-[#1f2130] focus-visible:outline-none transition"
              >
                <span className="text-zinc-500">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {item.shortcut && <span className="font-mono text-[10px] text-zinc-600">{item.shortcut}</span>}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};
