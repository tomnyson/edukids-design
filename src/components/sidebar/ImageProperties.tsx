import React, { useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { useDesignStore } from '../../store/useDesignStore';
import { ImageFit, ImageNode } from '../../types/pen-ast';
import { imageFit, readImageFile, safeImageSrc } from '../../lib/image-source';
import { notify } from '../../lib/toast';

const FITS: { value: ImageFit; label: string }[] = [
  { value: 'cover', label: 'Cover (cắt cho đầy)' },
  { value: 'contain', label: 'Contain (giữ trọn ảnh)' },
  { value: 'fill', label: 'Fill (kéo giãn)' },
];

const INPUT_CLASS =
  'w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-blue-500';

/** Uploaded images are megabytes of base64; show a label instead of the raw value */
function displaySrc(src: string | undefined): string {
  return src?.startsWith('data:') ? '' : src ?? '';
}

interface ImagePropertiesProps {
  image: ImageNode;
}

export const ImageProperties: React.FC<ImagePropertiesProps> = ({ image }) => {
  const updateNode = useDesignStore((s) => s.updateNode);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draftUrl, setDraftUrl] = useState(displaySrc(image.src));
  const isUploaded = image.src?.startsWith('data:') ?? false;

  // Keep the field in sync when another image is selected or the source is replaced
  useEffect(() => setDraftUrl(displaySrc(image.src)), [image.id, image.src]);

  const commitUrl = () => {
    const value = draftUrl.trim();
    if (!value || value === image.src) {
      setDraftUrl(displaySrc(image.src));
      return;
    }
    const safe = safeImageSrc(value);
    if (!safe) {
      notify('⚠️ Chỉ hỗ trợ link http(s).', 3000);
      setDraftUrl(displaySrc(image.src));
      return;
    }
    updateNode(image.id, { src: safe } as Partial<ImageNode>);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      updateNode(image.id, { src: await readImageFile(file) } as Partial<ImageNode>);
    } catch (error) {
      notify(`⚠️ ${error instanceof Error ? error.message : 'Không đọc được ảnh.'}`, 4000);
    }
  };

  return (
    <div className="space-y-2 border-t border-zinc-800/80 pt-3">
      <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Image</label>

      <div>
        <span className="text-[10px] text-zinc-500">Source URL</span>
        <input
          type="url"
          value={draftUrl}
          placeholder={isUploaded ? '(ảnh tải lên)' : 'https://...'}
          onChange={(e) => setDraftUrl(e.target.value)}
          onBlur={commitUrl}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          className={`${INPUT_CLASS} mt-1 font-mono`}
        />
      </div>

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="w-full flex items-center justify-center gap-1.5 py-1 rounded text-xs border bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 transition"
      >
        <Upload className="h-3 w-3" />
        Thay bằng ảnh từ máy
      </button>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className="text-[10px] text-zinc-500">Fit</span>
          <select
            value={imageFit(image.fit)}
            onChange={(e) => updateNode(image.id, { fit: imageFit(e.target.value) } as Partial<ImageNode>)}
            className={INPUT_CLASS}
          >
            {FITS.map((fit) => (
              <option key={fit.value} value={fit.value}>
                {fit.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className="text-[10px] text-zinc-500">Alt text</span>
          <input
            type="text"
            value={image.alt ?? ''}
            placeholder={image.name}
            onChange={(e) => updateNode(image.id, { alt: e.target.value } as Partial<ImageNode>)}
            className={INPUT_CLASS}
          />
        </div>
      </div>
    </div>
  );
};
