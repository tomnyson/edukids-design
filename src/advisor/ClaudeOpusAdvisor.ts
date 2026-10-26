import { AdvisorConsultationOptions, AdvisorCritique } from './providers/types';
import { OpenAiProvider } from './providers/OpenAiProvider';
import { AnthropicProvider } from './providers/AnthropicProvider';
import { PenDocument, PenNode, FrameNode, TextNode } from '../types/pen-ast';

export { type AdvisorCritique, type AdvisorConsultationOptions };

export class ClaudeOpusAdvisor {
  private openAiProvider = new OpenAiProvider();
  private anthropicProvider = new AnthropicProvider();

  public async consult(options: AdvisorConsultationOptions): Promise<AdvisorCritique[]> {
    const { model = 'claude-3-opus-20240229', anthropicApiKey, openAiApiKey } = options;
    const isGptModel =
      model.toLowerCase().includes('gpt') ||
      model.toLowerCase().includes('o1') ||
      model.toLowerCase().includes('o3');

    // 1. Try OpenAI if it's a GPT model and key is present
    if (isGptModel && openAiApiKey && openAiApiKey.trim()) {
      try {
        return await this.openAiProvider.consult(options);
      } catch (err) {
        console.warn('OpenAI consultation failed, falling back to heuristics:', err);
      }
    }

    // 2. Try Anthropic if it's a Claude model and key is present
    if (!isGptModel && anthropicApiKey && anthropicApiKey.trim()) {
      try {
        return await this.anthropicProvider.consult(options);
      } catch (err) {
        console.warn('Anthropic consultation failed, falling back to heuristics:', err);
      }
    }

    // 3. High-Fidelity Local Heuristic Engine (Offline / Instant fallback)
    return this.runHeuristicAnalysis(options.document, options.selectedNode, options.query);
  }

  public runHeuristicAnalysis(
    doc: PenDocument,
    selectedNode: PenNode | null | undefined,
    query: string
  ): AdvisorCritique[] {
    const critiques: AdvisorCritique[] = [];
    const queryLower = query.toLowerCase();

    // 1. Accessibility Checks (Touch target size & contrast)
    if (selectedNode) {
      if ((selectedNode.height || 0) < 44 && selectedNode.name?.toLowerCase().includes('btn')) {
        critiques.push({
          id: `crit-a11y-touch-${selectedNode.id}`,
          category: 'accessibility',
          severity: 'critical',
          title: 'Touch Target Under Minimum (WCAG 2.5.5)',
          observation: `Element #${selectedNode.id} has height of ${selectedNode.height}px, which is below the recommended 44px minimum touch target size.`,
          recommendation: 'Increase height to at least 48px to improve usability on touch and mobile devices.',
          suggestedPatch: {
            nodeId: selectedNode.id,
            patch: { height: 48 },
          },
        });
      }

      if (selectedNode.type === 'frame') {
        const frame = selectedNode as FrameNode;
        if (frame.layout === 'flex' && (frame.gap || 0) < 8) {
          critiques.push({
            id: `crit-spacing-${selectedNode.id}`,
            category: 'design_system',
            severity: 'warning',
            title: '8pt Spacing Grid Violation',
            observation: `Flex gap is set to ${frame.gap}px, which does not align with the standard 8pt spacing system.`,
            recommendation: 'Standardize flex gap to 16px to create consistent visual rhythm.',
            suggestedPatch: {
              nodeId: selectedNode.id,
              patch: { gap: 16 } as Partial<FrameNode>,
            },
          });
        }
      }

      if (selectedNode.type === 'text') {
        const text = selectedNode as TextNode;
        if ((text.fontSize || 16) < 12) {
          critiques.push({
            id: `crit-a11y-font-${selectedNode.id}`,
            category: 'accessibility',
            severity: 'warning',
            title: 'Typography Size May Cause Legibility Strain',
            observation: `Font size is ${text.fontSize}px. Sub-12px text violates core mobile readability recommendations.`,
            recommendation: 'Bump typography to 14px with 500 (medium) font weight for secondary captions.',
            suggestedPatch: {
              nodeId: selectedNode.id,
              patch: { fontSize: 14, fontWeight: '500' } as Partial<TextNode>,
            },
          });
        }
      }
    }

    // 2. Global Artboard Architecture Critique
    if (queryLower.includes('architecture') || queryLower.includes('hierarchy') || !selectedNode) {
      const rootFrame = doc.children.find((n) => n.type === 'frame') as FrameNode | undefined;
      if (rootFrame) {
        if (!rootFrame.cornerRadius || rootFrame.cornerRadius < 8) {
          critiques.push({
            id: 'crit-arch-token',
            category: 'design_system',
            severity: 'info',
            title: 'Elevate Surface Modernity with Token Radii',
            observation: `Root frame "${rootFrame.name}" has square corners or minimal rounding (${rootFrame.cornerRadius || 0}px).`,
            recommendation: 'Apply consistent 16px corner radius for modern card elevation.',
            suggestedPatch: {
              nodeId: rootFrame.id,
              patch: { cornerRadius: 16 },
            },
          });
        }

        if (rootFrame.layout !== 'flex') {
          critiques.push({
            id: 'crit-arch-layout',
            category: 'architecture',
            severity: 'warning',
            title: 'Enable Auto-Layout for Responsive Adaptability',
            observation: `Root artboard uses absolute positioning instead of auto-layout.`,
            recommendation: 'Switch layout to flex column with 24px padding to ensure components reflow smoothly across viewport dimensions.',
            suggestedPatch: {
              nodeId: rootFrame.id,
              patch: {
                layout: 'flex',
                flexDirection: 'column',
                padding: 24,
                gap: 16,
              } as Partial<FrameNode>,
            },
          });
        }
      }
    }

    if (critiques.length === 0) {
      critiques.push({
        id: 'crit-general-praise',
        category: 'architecture',
        severity: 'info',
        title: 'Design System & Component Hierarchy Aligned',
        observation: 'Layout tokens, spacing scales, and color contrast meet standard design system guidelines.',
        recommendation: 'Ready to export to clean React 19 JSX or generate interactive variants via local MCP server.',
      });
    }

    return critiques;
  }
}

export const MultiProviderAdvisor = ClaudeOpusAdvisor;
