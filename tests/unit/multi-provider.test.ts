import { describe, it, expect, beforeEach } from 'vitest';
import { ClaudeOpusAdvisor } from '../../src/advisor/ClaudeOpusAdvisor';
import { useDesignStore } from '../../src/store/useDesignStore';
import { FrameNode, PenDocument } from '../../src/types/pen-ast';

describe('Multi-Provider Advisor & Autonomous Co-pilot', () => {
  beforeEach(() => {
    useDesignStore.setState({
      isAutoAdvisorEnabled: true,
      isAutonomousModeEnabled: true,
      toastMessage: null,
      document: {
        version: '2.13',
        children: [],
      },
      history: [{ document: { version: '2.13', children: [] } }],
      historyIndex: 0,
    });
  });

  it('should route consultation through MultiProviderAdvisor with fallback heuristics', async () => {
    const doc: PenDocument = {
      version: '2.13',
      children: [],
    };

    const smallBtn: FrameNode = {
      id: 'btn-test',
      type: 'frame',
      name: 'btn-test',
      x: 0,
      y: 0,
      width: 100,
      height: 30, // < 44px
      children: [],
    };

    const advisor = new ClaudeOpusAdvisor();

    // Test with GPT-4o model option (fallback to heuristics when no key)
    const critiquesGpt = await advisor.consult({
      model: 'gpt-4o',
      document: doc,
      selectedNode: smallBtn,
      query: 'Audit touch targets',
    });

    expect(critiquesGpt.length).toBeGreaterThan(0);
    const a11y = critiquesGpt.find((c) => c.category === 'accessibility');
    expect(a11y).toBeDefined();
    expect(a11y?.suggestedPatch?.patch.height).toBe(48);

    // Test with Claude Opus model option
    const critiquesClaude = await advisor.consult({
      model: 'claude-3-opus-20240229',
      document: doc,
      selectedNode: smallBtn,
      query: 'Audit touch targets',
    });

    expect(critiquesClaude.length).toBeGreaterThan(0);
  });

  it('should auto-apply autonomous patches to canvas nodes and set toast notification', () => {
    const store = useDesignStore.getState();
    const id = store.addNode({
      type: 'frame',
      name: 'btn-action',
      width: 120,
      height: 32, // under 44px
    });

    const mockCritiques = [
      {
        id: 'crit-1',
        category: 'accessibility' as const,
        severity: 'critical' as const,
        title: 'Fix touch target',
        observation: 'Small button',
        recommendation: 'Increase height',
        suggestedPatch: {
          nodeId: id,
          patch: { height: 48 },
        },
      },
    ];

    const appliedCount = useDesignStore.getState().applyAutonomousPatches(mockCritiques);
    expect(appliedCount).toBe(1);

    const updated = useDesignStore.getState();
    expect(updated.document.children[0].height).toBe(48);
    expect(updated.toastMessage).toContain('Advisor tự động áp dụng');
  });

  it('should allow user to toggle Auto-Advisor and Autonomous modes', () => {
    expect(useDesignStore.getState().isAutoAdvisorEnabled).toBe(true);
    expect(useDesignStore.getState().isAutonomousModeEnabled).toBe(true);

    useDesignStore.getState().toggleAutoAdvisor();
    expect(useDesignStore.getState().isAutoAdvisorEnabled).toBe(false);

    useDesignStore.getState().toggleAutonomousMode();
    expect(useDesignStore.getState().isAutonomousModeEnabled).toBe(false);
  });
});
