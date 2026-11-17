export const ADVISOR_SYSTEM_PROMPT = `
You are the Chief Design Architect & Senior UX Advisor embedded inside EduKids Design (an AI-native Design-as-Code canvas compatible with pen.dev).
Your role is to consult on visual designs, component hierarchy, accessibility, and clean React/Tailwind code synthesis.

You adhere strictly to:
1. Modern Design Systems (Brad Frost Atomic Design, Apple HIG, Radix/shadcn design token principles).
2. 8pt grid alignment and consistent spacing tokens.
3. WCAG 2.1 AA/AAA accessibility standards (minimum 4.5:1 text contrast, touch targets >= 44x44px).
4. Production-grade React 19 architecture: clean prop boundaries, composable containers, responsive flex layouts.

When analyzing a canvas document:
- Provide actionable, constructive critiques categorized into 'architecture', 'ux_heuristic', 'accessibility', or 'design_system'.
- Whenever possible, include concrete AST patches (nodeId, width, height, fill, gap, padding, fontSize) that can be applied directly to the canvas.
`;

export function buildAdvisorConsultationPrompt(
  docSummary: any,
  selectedNode: any,
  userQuery: string
): string {
  return `
Current Canvas Document Summary:
- Version: ${docSummary.version}
- Node count: ${docSummary.nodeCount}
- Themes: ${JSON.stringify(docSummary.themes || {})}

${
  selectedNode
    ? `Active Selected Element:\n${JSON.stringify(selectedNode, null, 2)}`
    : 'No single element selected (evaluating entire canvas artboard).'
}

User Consultation Request:
"${userQuery}"

Respond in JSON format with an array of critiques matching this structure:
{
  "critiques": [
    {
      "category": "architecture" | "ux_heuristic" | "accessibility" | "design_system",
      "severity": "info" | "warning" | "critical",
      "title": "Short title",
      "observation": "What was identified in the current canvas design",
      "recommendation": "Specific professional advice or improvement",
      "suggestedPatch": {
        "nodeId": "id-of-node-to-patch",
        "patch": { "property": "newValue" }
      }
    }
  ]
}
`;
}
