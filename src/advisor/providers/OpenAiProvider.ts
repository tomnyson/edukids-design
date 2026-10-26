import { ILlmProvider, AdvisorConsultationOptions, AdvisorCritique } from './types';
import { ADVISOR_SYSTEM_PROMPT, buildAdvisorConsultationPrompt } from '../prompts/consultant-prompt';

export class OpenAiProvider implements ILlmProvider {
  public name = 'OpenAI';

  public async consult(options: AdvisorConsultationOptions): Promise<AdvisorCritique[]> {
    const { openAiApiKey, model = 'gpt-4o', document, selectedNode, query } = options;

    if (!openAiApiKey || !openAiApiKey.trim()) {
      throw new Error('OpenAI API Key is missing. Please configure it in settings.');
    }

    const docSummary = {
      version: document.version,
      nodeCount: document.children.length,
      themes: document.themes,
    };

    const prompt = buildAdvisorConsultationPrompt(docSummary, selectedNode, query);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openAiApiKey.trim()}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: ADVISOR_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return [];

    try {
      const parsed = JSON.parse(content);
      const critiquesList = parsed.critiques || (Array.isArray(parsed) ? parsed : []);
      return critiquesList.map((c: any, index: number) => ({
        id: `openai-${Date.now()}-${index}`,
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
