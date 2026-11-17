import { describe, it, expect } from 'vitest';
import { buildCreatePrompt, HOME_PRESETS, findPreset } from '../../src/lib/home-presets';

describe('HOME_PRESETS', () => {
  it('lists the six starting points in display order, with unique ids', () => {
    expect(HOME_PRESETS.map((p) => p.id)).toEqual(['landing', 'mobile', 'web-app', 'slides', 'dashboard', 'other']);
    expect(new Set(HOME_PRESETS.map((p) => p.id)).size).toBe(HOME_PRESETS.length);
  });

  it('gives every preset except "other" a creation guide', () => {
    HOME_PRESETS.filter((p) => p.id !== 'other').forEach((p) => expect(p.guidance.length).toBeGreaterThan(20));
    expect(findPreset('other')?.guidance).toBe('');
  });
});

describe('buildCreatePrompt', () => {
  it('returns the trimmed prompt when no preset is chosen', () => {
    expect(buildCreatePrompt('  a bakery site  ', null)).toBe('a bakery site');
  });

  it('appends the preset guide after the prompt', () => {
    const landing = findPreset('landing')!;
    const result = buildCreatePrompt('a bakery site', landing);
    expect(result.startsWith('a bakery site\n\n')).toBe(true);
    expect(result).toContain(`${landing.label} guide:\n${landing.guidance}`);
  });

  it('adds nothing for a preset without a guide', () => {
    expect(buildCreatePrompt('a poster', findPreset('other')!)).toBe('a poster');
  });

  it('uses the guide alone when the prompt is empty', () => {
    const slides = findPreset('slides')!;
    expect(buildCreatePrompt('   ', slides)).toBe(`${slides.label} guide:\n${slides.guidance}`);
  });
});
