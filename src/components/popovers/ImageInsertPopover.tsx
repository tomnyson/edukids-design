import React, { useEffect, useRef, useState } from 'react';
import { Link2, Loader2, Upload } from 'lucide-react';
import { readImageFile } from '../../lib/image-source';
import { imageNameFromFile, insertImage } from '../../lib/image-insert';
import { notify } from '../../lib/toast';

interface ImageInsertPopoverProps {
  isOpen: boolean;
  onClose: () => void;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Không thêm được ảnh.';
}

/** Adds an image node from an uploaded file or an http(s) link */
export const ImageInsertPopover: React.FC<ImageInsertPopoverProps> = ({ isOpen, onClose }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  // Read through a ref so the listeners stay attached across re-renders
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    const handlePointerDown = (e: PointerEvent) => {
      const panel = panelRef.current;
      const trigger = (e.target as Element | null)?.closest?.('[data-image-insert-trigger]');
      if (panel && !panel.contains(e.target as Node) && !trigger) onCloseRef.current();
    };
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('pointerdown', handlePointerDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const run = async (task: () => Promise<void>) => {
    setIsBusy(true);
    try {
      await task();
      setUrl('');
      onClose();
    } catch (error) {
      notify(`⚠️ ${errorMessage(error)}`, 4000);
    } finally {
      setIsBusy(false);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    run(async () => {
      await insertImage(await readImageFile(file), { name: imageNameFromFile(file) });
    });
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    run(async () => {
      await insertImage(url.trim());
    });
  };

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Chèn ảnh"
      className="absolute left-full top-0 ml-3 w-72 p-3 flex flex-col gap-3 bg-[#161722]/95 backdrop-blur-md border border-[#2a2c3d] rounded-xl shadow-2xl text-zinc-200"
    >
      <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Chèn ảnh</span>

      <button
        type="button"
        disabled={isBusy}
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-[#34374d] px-3 py-3 text-xs text-zinc-300 hover:border-orange-500/60 hover:text-white hover:bg-[#1d1f2c] disabled:opacity-50 transition"
      >
        {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        Tải ảnh từ máy
      </button>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

      <form onSubmit={handleUrlSubmit} className="flex flex-col gap-2">
        <label className="flex items-center gap-2 rounded-lg bg-[#0f1017] border border-[#2a2c3d] px-2 focus-within:border-orange-500/60">
          <Link2 className="h-3.5 w-3.5 flex-shrink-0 text-zinc-500" />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            aria-label="Link ảnh"
            className="w-full bg-transparent py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={isBusy || !url.trim()}
          className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-500 disabled:opacity-40 disabled:pointer-events-none transition"
        >
          Thêm từ link
        </button>
      </form>

      <p className="text-[10px] leading-snug text-zinc-500">
        Có thể kéo thả file ảnh vào canvas. Ảnh tối đa 5MB. Chọn một frame trước để đặt ảnh vào giữa frame.
      </p>
    </div>
  );
};
