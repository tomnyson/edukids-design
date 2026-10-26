import React, { useState } from 'react';
import { X, ExternalLink, Monitor, Smartphone, Tablet } from 'lucide-react';
import { useDesignStore } from '../../store/useDesignStore';
import { findNodeById } from '../../core/io/pen-file-handler';
import { FrameNode } from '../../types/pen-ast';

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({ isOpen, onClose }) => {
  const { document: doc, selectedNodeIds } = useDesignStore();
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  if (!isOpen) return null;

  const targetNode =
    selectedNodeIds.length > 0
      ? (findNodeById(doc.children, selectedNodeIds[0]) as FrameNode) || doc.children[0]
      : (doc.children[0] as FrameNode);

  const deviceWidths = {
    desktop: 'w-[1024px]',
    tablet: 'w-[768px]',
    mobile: 'w-[375px]',
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#08090d]/95 backdrop-blur-xl text-zinc-100 select-none">
      {/* Top Preview Bar */}
      <div className="flex h-12 w-full items-center justify-between border-b border-[#202231] px-4 bg-[#101119]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-300">Prototype Preview:</span>
          <span className="font-mono text-xs text-orange-400 bg-orange-950/40 border border-orange-800/40 px-2 py-0.5 rounded">
            {targetNode?.name || 'Interactive View'}
          </span>
        </div>

        {/* Device Switcher */}
        <div className="flex items-center gap-1 bg-[#181a26] border border-[#27293a] p-1 rounded-lg">
          <button
            onClick={() => setDevice('desktop')}
            className={`p-1.5 rounded transition ${
              device === 'desktop' ? 'bg-[#25283b] text-white shadow' : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title="Desktop (1024px)"
          >
            <Monitor className="h-4 w-4" />
          </button>
          <button
            onClick={() => setDevice('tablet')}
            className={`p-1.5 rounded transition ${
              device === 'tablet' ? 'bg-[#25283b] text-white shadow' : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title="Tablet (768px)"
          >
            <Tablet className="h-4 w-4" />
          </button>
          <button
            onClick={() => setDevice('mobile')}
            className={`p-1.5 rounded transition ${
              device === 'mobile' ? 'bg-[#25283b] text-white shadow' : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title="Mobile (375px)"
          >
            <Smartphone className="h-4 w-4" />
          </button>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Simulated Device Frame Viewport */}
      <div className="flex-1 overflow-auto flex items-start justify-center p-8 bg-[#0a0b10]">
        <div
          className={`${deviceWidths[device]} min-h-[600px] bg-[#0f111a] border border-[#232638] rounded-xl shadow-2xl p-6 transition-all duration-300 space-y-6`}
        >
          {/* Mock Interactive Render */}
          <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
            <span className="font-bold text-lg text-sky-400">THANH HẢI PRO</span>
            <div className="flex gap-4 text-xs text-zinc-400">
              <span className="hover:text-white cursor-pointer">Sản phẩm</span>
              <span className="hover:text-white cursor-pointer">Quy trình</span>
              <span className="hover:text-white cursor-pointer">Báo giá</span>
            </div>
            <button className="bg-sky-500 hover:bg-sky-400 text-white font-medium text-xs px-3 py-1.5 rounded-lg transition">
              Liên Hệ Ngay
            </button>
          </div>

          <div className="text-center py-12 space-y-4">
            <span className="text-[11px] font-mono font-bold tracking-widest text-sky-400 uppercase bg-sky-950/40 border border-sky-800/40 px-3 py-1 rounded-full">
              CÔNG NGHỆ IN ẤN CHẤT LƯỢNG CAO
            </span>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              IN ĐẸP DẤU GIÀY & TEM NHÃN CAO CẤP
            </h1>
            <p className="text-zinc-400 text-sm max-w-md mx-auto">
              Giải pháp in chuyển nhiệt, in lưới và gia công nhãn mác công nghiệp tiêu chuẩn ISO.
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <button className="bg-gradient-to-r from-sky-500 to-blue-600 text-white font-medium text-xs px-5 py-2.5 rounded-lg shadow-lg hover:opacity-95 transition">
                Nhận Báo Giá Nhanh
              </button>
              <button className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs px-5 py-2.5 rounded-lg border border-zinc-700 transition">
                Xem Mẫu In
              </button>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-3 gap-4 pt-4">
            <div className="bg-[#161928] border border-[#23273d] p-4 rounded-xl space-y-2">
              <div className="h-28 bg-[#10121d] rounded-lg border border-zinc-800/60" />
              <h3 className="font-bold text-xs text-zinc-200">Tem Nhãn May Mặc</h3>
              <p className="text-[11px] text-zinc-400">Độ bền màu cao, không bong tróc.</p>
            </div>
            <div className="bg-[#161928] border border-[#23273d] p-4 rounded-xl space-y-2">
              <div className="h-28 bg-[#10121d] rounded-lg border border-zinc-800/60" />
              <h3 className="font-bold text-xs text-zinc-200">Decal & Bao Bì</h3>
              <p className="text-[11px] text-zinc-400">Chống nước, keo dính chuyên dụng.</p>
            </div>
            <div className="bg-[#161928] border border-[#23273d] p-4 rounded-xl space-y-2">
              <div className="h-28 bg-[#10121d] rounded-lg border border-zinc-800/60" />
              <h3 className="font-bold text-xs text-zinc-200">Hộp Giấy & Thùng Carton</h3>
              <p className="text-[11px] text-zinc-400">In offset sắc nét, chuẩn thương hiệu.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
