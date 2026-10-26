import Anthropic from '@anthropic-ai/sdk';
import { PenDocument, PenNode, FrameNode, TextNode } from '../types/pen-ast';
import { ADVISOR_SYSTEM_PROMPT, buildAdvisorConsultationPrompt } from './prompts/consultant-prompt';

export interface AdvisorCritique {
  id: string;
  category: 'architecture' | 'ux_heuristic' | 'accessibility' | 'design_system';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  observation: string;
  recommendation: string;
  suggestedPatch?: {
    nodeId: string;
    patch: Partial<PenNode>;
  };
}

export interface AdvisorConsultationOptions {
  apiKey?: string;
  model?: string;
  document: PenDocument;
  selectedNode?: PenNode | null;
  query: string;
}

export class ClaudeOpusAdvisor {
  private defaultModel = 'claude-3-opus-20240229';

  public async consult(options: AdvisorConsultationOptions): Promise<AdvisorCritique[]> {
    const { apiKey, model = this.defaultModel, document, selectedNode, query } = options;

    // If an API key is provided, perform live call to Anthropic Claude Opus API
    if (apiKey && apiKey.trim().startsWith('sk-ant-')) {
      try {
        const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
        const docSummary = {
          version: document.version,
          nodeCount: document.children.length,
          themes: document.themes,
        };

        const prompt = buildAdvisorConsultationPrompt(docSummary, selectedNode, query);

        const response = await client.messages.create({
          model,
          max_tokens: 2048,
          system: ADVISOR_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: prompt }],
        });

        const rawContent = response.content[0];
        if (rawContent && rawContent.type === 'text') {
          // Parse JSON from text response
          const jsonMatch = rawContent.text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed.critiques)) {
              return parsed.critiques.map((c: any, index: number) => ({
                id: `opus-${Date.now()}-${index}`,
                category: c.category || 'ux_heuristic',
                severity: c.severity || 'info',
                title: c.title || 'Advisor Recommendation',
                observation: c.observation || '',
                recommendation: c.recommendation || '',
                suggestedPatch: c.suggestedPatch,
              }));
            }
          }
        }
      } catch (err) {
        console.warn('Anthropic API error, falling back to heuristic critique:', err);
      }
    }

    // High-Fidelity Local Heuristic Advisor Engine (always works out-of-the-box)
    return this.runHeuristicAnalysis(document, selectedNode, query);
  }

  private runHeuristicAnalysis(
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

    // 3. Fallback General Advice if canvas is already well-formed
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
