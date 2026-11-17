import React from 'react';
import { FileText, X } from 'lucide-react';
import { RecentEntry } from '../../core/io/recent-files';
import { activityLabel } from '../../lib/relative-time';
import { FrameThumbnail } from '../sidebar/FrameThumbnail';

const THUMB = { width: 248, height: 150 };

interface DocumentCardProps {
  entry: RecentEntry;
  now: number;
  isOpening: boolean;
  onOpen: (entry: RecentEntry) => void;
  onRemove: (entry: RecentEntry) => void;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({ entry, now, isOpening, onOpen, onRemove }) => {
  const cover = entry.preview[0];
  return (
    <li className="group relative">
      <button
        type="button"
        onClick={() => onOpen(entry)}
        disabled={isOpening}
        className="flex w-full flex-col overflow-hidden rounded-xl border border-[#23253a] bg-[#12131b] text-left transition duration-200 hover:-translate-y-0.5 hover:border-[#3a3d57] hover:shadow-[0_12px_32px_-12px_rgba(0,0,0,0.8)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60 disabled:opacity-60 disabled:cursor-wait cursor-pointer"
      >
        <div
          className="flex items-center justify-center overflow-hidden border-b border-[#1d1f2e] bg-[#0b0c11] bg-[radial-gradient(#1c1e2b_1px,transparent_1px)] [background-size:12px_12px]"
          style={{ height: THUMB.height }}
        >
          {cover ? (
            <FrameThumbnail frame={cover} width={THUMB.width} height={THUMB.height - 24} />
          ) : (
            <FileText className="h-8 w-8 text-zinc-700" aria-hidden />
          )}
        </div>
        <div className="flex flex-col gap-0.5 px-3 py-2.5">
          <span className="truncate font-mono text-[12px] text-zinc-200">{entry.name}</span>
          <span className="text-[11px] text-zinc-500">{isOpening ? 'Đang mở…' : activityLabel(entry, now)}</span>
        </div>
      </button>
      <button
        type="button"
        onClick={() => onRemove(entry)}
        aria-label={`Xoá ${entry.name} khỏi danh sách gần đây`}
        title="Xoá khỏi danh sách (không xoá file)"
        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md bg-[#0c0d12]/80 text-zinc-400 opacity-0 backdrop-blur transition hover:text-zinc-100 focus-visible:opacity-100 group-hover:opacity-100 cursor-pointer"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </li>
  );
};
