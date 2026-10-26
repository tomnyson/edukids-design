import React, { useRef } from 'react';
import {
  Paperclip,
  FolderKanban,
  Globe,
  Palette,
  Box,
} from 'lucide-react';
import { useDesignStore } from '../../store/useDesignStore';

interface AddToContextPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenBrowserImport: () => void;
}

export const AddToContextPopover: React.FC<AddToContextPopoverProps> = ({
  isOpen,
  onClose,
  onOpenBrowserImport,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addContextAttachment } = useDesignStore();

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        addContextAttachment({
          id: `file-${Date.now()}`,
          type: 'image',
          name: file.name,
          previewUrl: ev.target?.result as string,
        });
        onClose();
      };
      reader.readAsDataURL(file);
    } else {
      addContextAttachment({
        id: `file-${Date.now()}`,
        type: 'file',
        name: file.name,
      });
      onClose();
    }
  };

  const handleSelectStyle = (styleName: string) => {
    addContextAttachment({
      id: `style-${Date.now()}`,
      type: 'style',
      name: `Style: ${styleName}`,
    });
    onClose();
  };

  const handleSelectSkill = (skillName: string) => {
    addContextAttachment({
      id: `skill-${Date.now()}`,
      type: 'skill',
      name: `Skill: ${skillName}`,
    });
    onClose();
  };

  return (
    <>
      {/* Click outside backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div className="absolute bottom-12 left-0 w-60 rounded-xl bg-[#171825] border border-[#2b2d42] p-1.5 shadow-2xl z-50 select-none text-zinc-200 animate-in fade-in zoom-in-95 duration-100">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.json,.pen,.md,.txt"
          onChange={handleFileUpload}
          className="hidden"
        />

        <div className="px-2.5 py-1 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
          ADD TO CONTEXT
        </div>

        <div className="space-y-0.5">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-zinc-300 hover:text-white hover:bg-[#222436] transition text-left cursor-pointer"
          >
            <Paperclip className="h-4 w-4 text-zinc-400" />
            <span>Add image or file</span>
          </button>

          <button
            onClick={() => {
              addContextAttachment({
                id: 'ws-design-md',
                type: 'file',
                name: 'DESIGN.md',
              });
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-zinc-300 hover:text-white hover:bg-[#222436] transition text-left cursor-pointer"
          >
            <FolderKanban className="h-4 w-4 text-zinc-400" />
            <span>Add from workspace</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onOpenBrowserImport();
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-zinc-300 hover:text-white hover:bg-[#222436] transition text-left cursor-pointer"
          >
            <Globe className="h-4 w-4 text-zinc-400" />
            <span>Import from browser</span>
          </button>

          <button
            onClick={() => handleSelectStyle('Neon Glass AI')}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-zinc-300 hover:text-white hover:bg-[#222436] transition text-left cursor-pointer"
          >
            <Palette className="h-4 w-4 text-zinc-400" />
            <span>Choose a style</span>
          </button>

          <button
            onClick={() => handleSelectSkill('8pt Grid & WCAG AA')}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-zinc-300 hover:text-white hover:bg-[#222436] transition text-left cursor-pointer"
          >
            <Box className="h-4 w-4 text-zinc-400" />
            <span>Pick a skill</span>
          </button>
        </div>
      </div>
    </>
  );
};
