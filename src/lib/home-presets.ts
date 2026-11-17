export type HomePresetId = 'landing' | 'mobile' | 'web-app' | 'slides' | 'dashboard' | 'other';

/** A starting point on the Home screen: its guide is sent along with the user's prompt */
export interface HomePreset {
  id: HomePresetId;
  label: string;
  guidance: string;
}

export const HOME_PRESETS: readonly HomePreset[] = [
  {
    id: 'landing',
    label: 'Landing page',
    guidance:
      'One desktop frame 1440px wide. Stack a hero with a clear headline and primary call to action, then proof (logos or numbers), features, and a closing call to action with a footer.',
  },
  {
    id: 'mobile',
    label: 'Mobile app',
    guidance:
      'Phone frames 390x844, one per screen, placed side by side. Leave room for the status bar, keep touch targets at least 44px, and put primary navigation in a bottom tab bar.',
  },
  {
    id: 'web-app',
    label: 'Web app',
    guidance:
      'Desktop frames 1440x900. Use a persistent navigation area and a focused main workspace; show realistic content and states rather than lorem ipsum.',
  },
  {
    id: 'slides',
    label: 'Slides',
    guidance:
      'Slides as 1920x1080 frames in a row, one idea per slide. Start with a title slide, keep text large and short, and end with a summary or next steps.',
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    guidance:
      'One desktop frame 1440x900. Lead with the few key metrics, then trends and breakdowns; align everything to a grid and keep labels and units visible.',
  },
  { id: 'other', label: 'Something else…', guidance: '' },
];

export function findPreset(id: HomePresetId): HomePreset | undefined {
  return HOME_PRESETS.find((preset) => preset.id === id);
}

/** The prompt sent to the agent: what the user typed, then the preset's guide when it has one */
export function buildCreatePrompt(prompt: string, preset: HomePreset | null): string {
  const guide = preset?.guidance ? `${preset.label} guide:\n${preset.guidance}` : '';
  return [prompt.trim(), guide].filter(Boolean).join('\n\n');
}
