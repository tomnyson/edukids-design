import { describe, it, expect } from 'vitest';
import { PenMcpEngine } from '../../src/mcp/engine';
import { ClaudeOpusAdvisor } from '../../src/advisor/ClaudeOpusAdvisor';
import { compileAstToJsx, generateReactComponent } from '../../src/compiler/ast-to-jsx';
import { FrameNode } from '../../src/types/pen-ast';

describe('E2E Design-as-Code Workflow (REA -> MCP -> Advisor -> CodeGen)', () => {
  it('should execute full roundtrip: MCP mutation -> Advisor critique -> Fix -> React JSX export', async () => {
    // 1. Initialize MCP engine with starter document
    const engine = new PenMcpEngine();
    
    // 2. External agent calls MCP tool `execute` to insert a button
    const mcpResult = engine.execute({
      description: 'Add primary checkout button',
      input: `
        canvas.addNode({
          id: 'btn-checkout',
          type: 'frame',
          name: 'btn-checkout',
          width: 140,
          height: 32, // Intentional touch target flaw for advisor to catch
          fill: '#ea580c',
          cornerRadius: 8,
          layout: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          children: [
            {
              id: 'txt-checkout',
              type: 'text',
              name: 'Checkout Text',
              content: 'Complete Purchase',
              fontSize: 14,
              fontWeight: '600',
              fill: '#ffffff'
            }
          ]
        });
      `,
    });

    expect(mcpResult.success).toBe(true);
    const docAfterMcp = engine.getDocument();
    expect(docAfterMcp.children).toHaveLength(1);
    const buttonNode = docAfterMcp.children[0] as FrameNode;
    expect(buttonNode.id).toBe('btn-checkout');
    expect(buttonNode.height).toBe(32);

    // 3. User / Agent consults Claude Opus Advisor
    const advisor = new ClaudeOpusAdvisor();
    const critiques = await advisor.consult({
      document: docAfterMcp,
      selectedNode: buttonNode,
      query: 'Audit button for accessibility and touch targets',
    });

    expect(critiques.length).toBeGreaterThan(0);
    const a11yCritique = critiques.find((c) => c.category === 'accessibility');
    expect(a11yCritique).toBeDefined();
    expect(a11yCritique?.suggestedPatch).toBeDefined();

    // 4. Apply Advisor's suggested patch to the document
    if (a11yCritique?.suggestedPatch) {
      engine.execute({
        description: 'Apply advisor touch target fix',
        input: `
          canvas.updateNode('${a11yCritique.suggestedPatch.nodeId}', ${JSON.stringify(
            a11yCritique.suggestedPatch.patch
          )});
        `,
      });
    }

    const docAfterFix = engine.getDocument();
    const fixedButton = docAfterFix.children[0] as FrameNode;
    expect(fixedButton.height).toBe(48); // Fixed to 48px!

    // 5. Export to React 19 JSX Component
    const exportedJsx = compileAstToJsx(fixedButton);
    expect(exportedJsx).toContain('button');
    expect(exportedJsx).toContain('h-[48px]');
    expect(exportedJsx).toContain('bg-[#ea580c]');
    expect(exportedJsx).toContain('Complete Purchase');

    const fullModule = generateReactComponent(fixedButton, 'CheckoutButton');
    expect(fullModule).toContain('export function CheckoutButton()');
    expect(fullModule).toContain('export default CheckoutButton;');
  });
});
