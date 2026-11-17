import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight } from 'lucide-react';
import { useDesignStore } from '../../store/useDesignStore';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import { buildMenu, clampMenuPosition, MenuEntry } from '../../lib/context-menu';
import { findParentId } from '../../lib/canvas-editing';
import { CopyFormat } from '../../lib/copy-as';
import { Point } from '../../lib/node-ops';
import { PasteTarget, runContextAction, runCopyAs, selectedTopNodes } from './context-actions';

export interface ContextMenuState {
  /** Viewport position of the right-click */
  screen: Point;
  targetIsNode: boolean;
  /** Canvas point for "Paste here"; without one (the Layers panel) it pastes like Cmd+V */
  paste?: PasteTarget;
}

interface CanvasContextMenuProps {
  menu: ContextMenuState;
  onClose: () => void;
}

const COPY_FORMATS: { format: CopyFormat; label: string }[] = [
  { format: 'json', label: 'JSON' },
  { format: 'jsx', label: 'JSX' },
  { format: 'html', label: 'HTML' },
  { format: 'png', label: 'PNG' },
];

const PANEL_CLASS = 'w-56 rounded-xl bg-[#141520] border border-[#2a2c40] shadow-2xl py-1 text-xs select-none';
const SUBMENU_WIDTH = 140;

function itemClass(entry: Pick<MenuEntry, 'enabled' | 'danger'>): string {
  const tone = entry.danger ? 'text-red-400' : 'text-zinc-200';
  return `flex w-full items-center gap-3 px-3 py-1.5 text-left transition ${
    entry.enabled ? `${tone} hover:bg-[#1e2030] focus:bg-[#1e2030] focus:outline-none` : 'text-zinc-600 cursor-default'
  }`;
}

/** Right-click menu for layers on the canvas, modelled on pen.dev's */
export const CanvasContextMenu: React.FC<CanvasContextMenuProps> = ({ menu, onClose }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Point>(menu.screen);
  const [isCopyAsOpen, setIsCopyAsOpen] = useState(false);
  const [submenuOnLeft, setSubmenuOnLeft] = useState(false);
  const hasClipboard = useDesignStore((state) => state.clipboard.length > 0);
  // Re-read on every selection change so the enabled states match what the actions will see
  useDesignStore((state) => state.selectedNodeIds);
  useEscapeToClose(true, onClose);

  const selection = selectedTopNodes();
  const { document: doc } = useDesignStore.getState();
  const parents = new Set(selection.map((node) => findParentId(doc.children, node.id)));
  const entries = buildMenu({ targetIsNode: menu.targetIsNode, selection, sameParent: parents.size === 1, hasClipboard });

  // Measure once mounted, then keep the menu (and the submenu side) inside the window
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const next = clampMenuPosition(menu.screen, { width: el.offsetWidth, height: el.offsetHeight }, viewport);
    setPosition(next);
    setSubmenuOnLeft(next.x + el.offsetWidth + SUBMENU_WIDTH > viewport.width);
  }, [menu.screen]);

  // Outside clicks, canvas scrolling and leaving the window all close the menu
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) onClose();
    };
    const handleWheel = (e: WheelEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('blur', onClose);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('blur', onClose);
    };
  }, [onClose]);

  useEffect(() => {
    rootRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')?.focus();
  }, []);

  const runAction = (entry: MenuEntry) => {
    if (!entry.enabled || !entry.action) return;
    onClose();
    runContextAction(entry.action, menu.paste);
  };

  const copyAs = (format: CopyFormat) => {
    onClose();
    void runCopyAs(format);
  };

  const renderEntry = (entry: MenuEntry, index: number) => {
    if (entry.kind === 'separator') return <div key={`sep-${index}`} role="separator" className="my-1 border-t border-[#22243a]" />;

    const isCopyAs = entry.kind === 'submenu' && entry.label === 'Copy as';
    const openSubmenu = () => entry.enabled && isCopyAs && setIsCopyAsOpen(true);
    return (
      <div
        key={entry.label}
        className="relative"
        onMouseEnter={() => (isCopyAs ? openSubmenu() : setIsCopyAsOpen(false))}
        onMouseLeave={() => isCopyAs && setIsCopyAsOpen(false)}
      >
        <button
          type="button"
          role="menuitem"
          aria-disabled={!entry.enabled}
          aria-haspopup={entry.kind === 'submenu' ? 'menu' : undefined}
          aria-expanded={isCopyAs ? isCopyAsOpen : undefined}
          title={entry.hint}
          onFocus={() => (isCopyAs ? openSubmenu() : setIsCopyAsOpen(false))}
          onClick={() => (isCopyAs ? openSubmenu() : runAction(entry))}
          className={itemClass(entry)}
        >
          <span className="flex-1 truncate">{entry.label}</span>
          {entry.shortcut && <span className="font-mono text-[11px] text-zinc-500">{entry.shortcut}</span>}
          {entry.kind === 'submenu' && <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />}
        </button>

        {isCopyAs && isCopyAsOpen && (
          <div
            role="menu"
            aria-label="Copy as"
            style={{ width: SUBMENU_WIDTH }}
            className={`absolute top-0 ${submenuOnLeft ? 'right-full mr-1' : 'left-full ml-1'} ${PANEL_CLASS}`}
          >
            {COPY_FORMATS.map(({ format, label }) => (
              <button
                key={format}
                type="button"
                role="menuitem"
                onClick={() => copyAs(format)}
                className={itemClass({ enabled: true })}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Portalled out of the canvas DOM so it is never clipped or transformed by it
  return createPortal(
    <div
      ref={rootRef}
      role="menu"
      aria-label="Layer actions"
      style={{ left: position.x, top: position.y }}
      className={`fixed z-50 ${PANEL_CLASS}`}
      // Portals still bubble React events to the canvas, which would deselect or pan
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {entries.map(renderEntry)}
    </div>,
    document.body
  );
};
