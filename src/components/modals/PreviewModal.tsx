import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, ExternalLink, Monitor, Smartphone, Tablet, Maximize2 } from 'lucide-react';
import { useDesignStore } from '../../store/useDesignStore';
import { buildHtmlDocument, findTopLevelId } from '../../compiler/ast-to-html';
import { expandInstances } from '../../lib/components';

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Device = 'actual' | 'desktop' | 'tablet' | 'mobile';

const DEVICES: { id: Device; label: string; width: number | null; icon: React.ReactNode }[] = [
  { id: 'actual', label: 'Kích thước thật', width: null, icon: <Maximize2 className="h-4 w-4" /> },
  { id: 'desktop', label: 'Desktop (1024px)', width: 1024, icon: <Monitor className="h-4 w-4" /> },
  { id: 'tablet', label: 'Tablet (768px)', width: 768, icon: <Tablet className="h-4 w-4" /> },
  { id: 'mobile', label: 'Mobile (375px)', width: 375, icon: <Smartphone className="h-4 w-4" /> },
];

/** Opens the compiled page in a new tab; the HTML has no scripts, so a blob URL is safe */
function openInNewTab(html: string): void {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export const PreviewModal: React.FC<PreviewModalProps> = ({ isOpen, onClose }) => {
  const { document: doc, selectedNodeIds } = useDesignStore();
  const [device, setDevice] = useState<Device>('actual');
  const [pickedId, setPickedId] = useState<string | null>(null);

  const frames = doc.children.filter((n) => n.visible !== false);
  const selectedTopId = selectedNodeIds.length > 0 ? findTopLevelId(doc.children, selectedNodeIds[0]) : null;

  // Each time the preview opens, start from the frame the user is working on
  useEffect(() => {
    if (isOpen) setPickedId(selectedTopId);
  }, [isOpen]);

  const target = frames.find((n) => n.id === pickedId) ?? frames[0] ?? null;
  const html = useMemo(() => {
    const [expanded] = target ? expandInstances([target], doc.children) : [];
    return expanded ? buildHtmlDocument(expanded) : '';
  }, [target, doc.children]);

  // onClose is an inline arrow in App: reading it through a ref keeps the
  // listener attached across re-renders, otherwise a re-render triggered by an
  // earlier keydown listener detaches it mid-dispatch and Escape is lost
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    // Capture phase, so canvas shortcuts behind the modal (deselect, delete) never see these keys
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen]);

  if (!isOpen) return null;

  const designWidth = Math.max(1, target?.width ?? 1);
  const designHeight = Math.max(1, target?.height ?? 1);
  const viewportWidth = DEVICES.find((d) => d.id === device)?.width ?? designWidth;
  const scale = viewportWidth / designWidth;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Preview"
      className="fixed inset-0 z-50 flex flex-col bg-[#08090d]/95 backdrop-blur-xl text-zinc-100 select-none"
    >
      {/* Top Preview Bar */}
      <div className="flex h-12 w-full items-center justify-between gap-4 border-b border-[#202231] px-4 bg-[#101119]">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-xs font-semibold text-zinc-300">Preview:</span>
          {frames.length > 1 ? (
            <select
              value={target?.id ?? ''}
              onChange={(e) => setPickedId(e.target.value)}
              className="max-w-[260px] truncate font-mono text-xs text-orange-400 bg-orange-950/40 border border-orange-800/40 px-2 py-0.5 rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-orange-500"
            >
              {frames.map((frame) => (
                <option key={frame.id} value={frame.id} className="bg-[#14151d] text-zinc-200">
                  {frame.name || frame.type}
                </option>
              ))}
            </select>
          ) : (
            <span className="truncate font-mono text-xs text-orange-400 bg-orange-950/40 border border-orange-800/40 px-2 py-0.5 rounded">
              {target?.name || 'Canvas trống'}
            </span>
          )}
          {target && (
            <span className="font-mono text-[11px] text-zinc-500">
              {designWidth}×{designHeight}
              {scale !== 1 && ` · ${Math.round(scale * 100)}%`}
            </span>
          )}
        </div>

        {/* Device Switcher */}
        <div className="flex items-center gap-1 bg-[#181a26] border border-[#27293a] p-1 rounded-lg">
          {DEVICES.map((d) => (
            <button
              key={d.id}
              onClick={() => setDevice(d.id)}
              aria-pressed={device === d.id}
              className={`p-1.5 rounded transition ${
                device === d.id ? 'bg-[#25283b] text-white shadow' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title={d.label}
            >
              {d.icon}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => openInNewTab(html)}
            disabled={!target}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-40 disabled:pointer-events-none transition"
            title="Mở trong tab mới"
          >
            <ExternalLink className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
            title="Đóng (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Viewport: the design is laid out at its own size, then scaled to the device width */}
      <div className="flex-1 overflow-auto flex items-start justify-center p-8 bg-[#0a0b10]">
        {target ? (
          <div
            className="flex-shrink-0 overflow-hidden rounded-xl border border-[#232638] shadow-2xl"
            style={{ width: viewportWidth, height: designHeight * scale }}
          >
            <iframe
              title={`Preview ${target.name || ''}`}
              srcDoc={html}
              sandbox=""
              style={{
                width: designWidth,
                height: designHeight,
                border: 0,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
              }}
            />
          </div>
        ) : (
          <p className="mt-24 text-sm text-zinc-500">Canvas trống. Hãy tạo hoặc mở một thiết kế trước.</p>
        )}
      </div>
    </div>
  );
};
