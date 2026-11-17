/** The one place the product's name lives; UI, window title and MCP setup read it from here */
export const BRAND = {
  name: 'EduKids Design',
  shortName: 'EduKids',
  tagline: 'AI Design-as-Code Canvas',
  mcpServerId: 'edukids-design',
} as const;

/** True inside the desktop app, where the window has a native title bar */
export function isDesktopApp(userAgent: string = globalThis.navigator?.userAgent ?? ''): boolean {
  return userAgent.includes('Electron');
}
