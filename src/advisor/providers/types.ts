import { PenDocument, PenNode } from '../../types/pen-ast';

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
  provider?: 'anthropic' | 'openai' | 'local';
  model?: string;
  document: PenDocument;
  selectedNode?: PenNode | null;
  query: string;
  anthropicApiKey?: string;
  openAiApiKey?: string;
}

export interface ILlmProvider {
  name: string;
  consult(options: AdvisorConsultationOptions): Promise<AdvisorCritique[]>;
}
