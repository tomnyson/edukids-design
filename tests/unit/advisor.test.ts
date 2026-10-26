import { describe, it, expect } from 'vitest';
import { ClaudeOpusAdvisor } from '../../src/advisor/ClaudeOpusAdvisor';
import { PenDocument, FrameNode } from '../../src/types/pen-ast';

describe('Claude Opus Advisor Consultation Engine', () => {
  it('should flag touch target size under 44px on button elements', async () => {
    const doc: PenDocument = {
      version: '2.13',
      children: [],
    };

    const smallButton: FrameNode = {
      id: 'btn-submit',
      type: 'frame',
      name: 'btn-submit',
      x: 0,
      y: 0,
      width: 120,
      height: 32, // < 44px
      children: [],
    };

    const advisor = new ClaudeOpusAdvisor();
    const critiques = await advisor.consult({
      document: doc,
      selectedNode: smallButton,
      query: 'Audit touch targets',
    });

    const a11yCritique = critiques.find((c) => c.category === 'accessibility');
    expect(a11yCritique).toBeDefined();
    expect(a11yCritique?.severity).toBe('critical');
    expect(a11yCritique?.suggestedPatch?.nodeId).toBe('btn-submit');
    expect(a11yCritique?.suggestedPatch?.patch.height).toBe(48);
  });

  it('should suggest 8pt grid alignment on non-standard flex gap', async () => {
    const doc: PenDocument = {
      version: '2.13',
      children: [],
    };

    const flexFrame: FrameNode = {
      id: 'frame-cards',
      type: 'frame',
      name: 'Cards Container',
      x: 0,
      y: 0,
      width: 600,
      height: 300,
      layout: 'flex',
      gap: 5, // non 8pt grid
      children: [],
    };

    const advisor = new ClaudeOpusAdvisor();
    const critiques = await advisor.consult({
      document: doc,
      selectedNode: flexFrame,
      query: 'Check spacing grid',
    });

    const gridCritique = critiques.find((c) => c.category === 'design_system');
    expect(gridCritique).toBeDefined();
    expect((gridCritique?.suggestedPatch?.patch as any)?.gap).toBe(16);
  });

  it('should recommend auto-layout for root artboard without flex', async () => {
    const doc: PenDocument = {
      version: '2.13',
      children: [
        {
          id: 'artboard-1',
          type: 'frame',
          name: 'Hero Artboard',
          x: 0,
          y: 0,
          width: 800,
          height: 600,
          layout: 'none',
          children: [],
        },
      ],
    };

    const advisor = new ClaudeOpusAdvisor();
    const critiques = await advisor.consult({
      document: doc,
      selectedNode: null,
      query: 'Review architecture and responsiveness',
    });

    const archCritique = critiques.find((c) => c.category === 'architecture');
    expect(archCritique).toBeDefined();
    expect((archCritique?.suggestedPatch?.patch as any)?.layout).toBe('flex');
  });
});
