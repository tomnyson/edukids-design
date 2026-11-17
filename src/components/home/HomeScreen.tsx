import React, { useRef, useState } from 'react';
import { Figma, Globe, ImagePlus } from 'lucide-react';
import { ChatInputBox, SendPromptHandler } from '../sidebar/ChatInputBox';
import { DocumentCard } from './DocumentCard';
import { buildCreatePrompt, HOME_PRESETS, HomePresetId } from '../../lib/home-presets';
import { RecentEntry } from '../../core/io/recent-files';
import { useRecents } from '../../hooks/useRecents';

const SCREENSHOT_TYPES = 'image/png,image/jpeg,image/webp,image/gif';

interface HomeScreenProps {
  onCreate: SendPromptHandler;
  isGenerating: boolean;
  onImportBrowser: () => void;
  onRecreateScreenshot: (file: File) => void;
  /** Resolves false when the file could not be opened */
  onOpenRecent: (entry: RecentEntry) => Promise<boolean>;
}

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  hint?: string;
}

const ActionButton: React.FC<ActionButtonProps> = ({ icon, label, onClick, hint }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!onClick}
    title={hint}
    className="flex items-center gap-2 rounded-lg border border-[#262839] bg-[#13141c] px-3 py-2 text-xs text-zinc-300 transition hover:border-[#3a3d57] hover:bg-[#1a1b26] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-[#262839] disabled:hover:bg-[#13141c] cursor-pointer"
  >
    {icon}
    <span>{label}</span>
    {hint && <span className="rounded bg-[#20222f] px-1.5 py-px text-[10px] text-zinc-500">{hint}</span>}
  </button>
);

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onCreate,
  isGenerating,
  onImportBrowser,
  onRecreateScreenshot,
  onOpenRecent,
}) => {
  const [presetId, setPresetId] = useState<HomePresetId | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const screenshotInput = useRef<HTMLInputElement>(null);
  const recents = useRecents();
  const now = Date.now();

  const preset = HOME_PRESETS.find((p) => p.id === presetId) ?? null;

  const handleSend: SendPromptHandler = (prompt, model) => onCreate(buildCreatePrompt(prompt, preset), model);

  const handleOpen = async (entry: RecentEntry) => {
    setOpeningId(entry.id);
    try {
      await onOpenRecent(entry);
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <section
      aria-labelledby="home-heading"
      className="relative h-full w-full overflow-y-auto bg-[#0c0d12] bg-[radial-gradient(ellipse_70%_45%_at_50%_-5%,rgba(249,115,22,0.09),transparent_70%)]"
    >
      <div className="mx-auto flex max-w-[960px] flex-col px-4 pb-16 pt-[clamp(3rem,10vh,7rem)] sm:px-8">
        <h1
          id="home-heading"
          className="text-center text-[clamp(1.6rem,1.2rem+1.4vw,2.4rem)] font-semibold tracking-tight text-zinc-100"
        >
          What will you design today?
        </h1>

        <div role="group" aria-label="Kind of design" className="mt-8 flex flex-wrap justify-center gap-2">
          {HOME_PRESETS.map((p) => {
            const active = p.id === presetId;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={active}
                onClick={() => setPresetId(active ? null : p.id)}
                className={`rounded-full border px-3.5 py-1.5 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60 cursor-pointer ${
                  active
                    ? 'border-orange-500/60 bg-orange-500/15 text-orange-200'
                    : 'border-[#262839] bg-[#13141c] text-zinc-400 hover:border-[#3a3d57] hover:text-zinc-100'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <div className="mx-auto mt-4 w-full max-w-[720px]">
          <ChatInputBox
            onSend={handleSend}
            isLoading={isGenerating}
            onOpenBrowserImport={onImportBrowser}
            placeholder={
              preset && preset.id !== 'other' ? `Describe your ${preset.label.toLowerCase()}…` : 'Design anything…'
            }
            size="large"
          />
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <ActionButton icon={<Figma className="h-3.5 w-3.5" />} label="Import from Figma" hint="Sắp có" />
          <ActionButton
            icon={<Globe className="h-3.5 w-3.5" />}
            label="Import from browser"
            onClick={onImportBrowser}
          />
          <ActionButton
            icon={<ImagePlus className="h-3.5 w-3.5" />}
            label="Recreate a screenshot"
            onClick={() => screenshotInput.current?.click()}
          />
          <input
            ref={screenshotInput}
            type="file"
            accept={SCREENSHOT_TYPES}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) onRecreateScreenshot(file);
            }}
          />
        </div>

        <div className="mt-16 flex items-baseline justify-between border-b border-[#1d1f2c] pb-2">
          <h2 className="text-sm font-medium text-zinc-200">Recents</h2>
          {recents.entries.length > 0 && (
            <span className="text-[11px] text-zinc-600">{recents.entries.length} file</span>
          )}
        </div>

        {recents.error && <p className="mt-4 text-xs text-amber-400">{recents.error}</p>}
        {!recents.isLoading && recents.entries.length === 0 && !recents.error && (
          <p className="mt-6 text-xs leading-relaxed text-zinc-500">
            File .pen bạn mở hoặc lưu sẽ hiện ở đây. Dùng File → Open (⌘O) để mở file có sẵn.
          </p>
        )}
        {recents.entries.length > 0 && (
          <ul className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
            {recents.entries.map((entry) => (
              <DocumentCard
                key={entry.id}
                entry={entry}
                now={now}
                isOpening={openingId === entry.id}
                onOpen={handleOpen}
                onRemove={(e) => void recents.remove(e.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};
