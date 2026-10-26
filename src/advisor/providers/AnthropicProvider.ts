import Anthropic from '@anthropic-ai/sdk';
import { ILlmProvider, AdvisorConsultationOptions, AdvisorCritique } from './types';
import { ADVISOR_SYSTEM_PROMPT, buildAdvisorConsultationPrompt } from '../prompts/consultant-prompt';

export class AnthropicProvider implements ILlmProvider {
  public name = 'Anthropic';

  public async consult(options: AdvisorConsultationOptions): Promise<AdvisorCritique[]> {
    const { anthropicApiKey, model = 'claude-3-opus-20240229', document, selectedNode, query } = options;

    if (!anthropicApiKey || !anthropicApiKey.trim()) {
      throw new Error('Anthropic API Key is missing. Please configure it in settings.');
    }

    const client = new Anthropic({ apiKey: anthropicApiKey.trim(), dangerouslyAllowBrowser: true });
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
    if (!rawContent || rawContent.type !== 'text') return [];

    const jsonMatch = rawContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      const critiquesList = parsed.critiques || (Array.isArray(parsed) ? parsed : []);
      return critiquesList.map((c: any, index: number) => ({
        id: `anthropic-${Date.now()}-${index}`,
        category: c.category || 'ux_heuristic',
        severity: c.severity || 'info',
        title: c.title || 'Advisor Recommendation',
        observation: c.observation || '',
        recommendation: c.recommendation || '',
        suggestedPatch: c.suggestedPatch,
      }));
    } catch {
      return [];
    }
  }
}
