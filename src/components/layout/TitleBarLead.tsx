/** Width the native macOS window buttons occupy in the desktop app's hidden title bar */
const NATIVE_BUTTONS_WIDTH = 68;

interface TitleBarLeadProps {
  desktop: boolean;
}

/**
 * Start of the title bar. The browser gets decorative window buttons; the
 * desktop app has real ones there, so it only gets the room they need.
 */
export function TitleBarLead({ desktop }: TitleBarLeadProps) {
  if (desktop) return <div aria-hidden style={{ width: NATIVE_BUTTONS_WIDTH, flexShrink: 0 }} />;
  return (
    <div className="flex items-center gap-2 pr-1" aria-hidden>
      <div className="h-3 w-3 rounded-full bg-[#ff5f56]" />
      <div className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
      <div className="h-3 w-3 rounded-full bg-[#27c93f]" />
    </div>
  );
}
