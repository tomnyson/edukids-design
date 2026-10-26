import React, { useState } from 'react';
import { X, Copy, Check, Plus, Code2 } from 'lucide-react';
import { useDesignStore } from '../../store/useDesignStore';
import { generateReactComponent } from '../../compiler/ast-to-jsx';
import { parseJsxToAst } from '../../compiler/jsx-to-ast';
import { findNodeById } from '../../core/io/pen-file-handler';

interface CodePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CodePreviewModal: React.FC<CodePreviewModalProps> = ({ isOpen, onClose }) => {
  const { document: doc, selectedNodeIds, addNode } = useDesignStore();
  const [copied, setCopied] = useState(false);
  const [pasteInput, setPasteInput] = useState('');
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');

  if (!isOpen) return null;

  // Generate code for selected node or first root child
  const targetNode =
    selectedNodeIds.length > 0
      ? findNodeById(doc.children, selectedNodeIds[0]) || doc.children[0]
      : doc.children[0];

  const generatedCode = targetNode
    ? generateReactComponent(targetNode, targetNode.name?.replace(/[^a-zA-Z0-9]/g, '') || 'GeneratedView')
    : '// No element available to export';

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImportJsx = () => {
    if (!pasteInput.trim()) return;
    try {
      const node = parseJsxToAst(pasteInput);
      addNode(node);
      setPasteInput('');
      onClose();
    } catch (err) {
      alert('Failed to parse JSX: ' + (err as Error).message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="flex flex-col h-[520px] w-[680px] bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-orange-400" />
            <span className="font-semibold text-sm">Bidirectional Code Sync</span>
          </div>

          <div className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded-lg border border-zinc-800 text-xs">
            <button
              onClick={() => setActiveTab('export')}
              className={`px-3 py-1 rounded transition ${
                activeTab === 'export' ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Export React JSX
            </button>
            <button
              onClick={() => setActiveTab('import')}
              className={`px-3 py-1 rounded transition ${
                activeTab === 'import' ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Paste JSX &rarr; Canvas
            </button>
          </div>

          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-4 overflow-hidden flex flex-col">
          {activeTab === 'export' ? (
            <div className="flex-1 flex flex-col space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Tailwind CSS Component: <span className="font-mono text-orange-400">{targetNode?.name || 'Root'}</span></span>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-2.5 py-1 rounded border border-zinc-700 transition"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy JSX'}</span>
                </button>
              </div>
              <pre className="flex-1 overflow-auto bg-zinc-950 p-3 rounded-lg border border-zinc-800 font-mono text-xs text-zinc-300 leading-relaxed">
                <code>{generatedCode}</code>
              </pre>
            </div>
          ) : (
            <div className="flex-1 flex flex-col space-y-3">
              <p className="text-xs text-zinc-400">
                Paste any React JSX element or HTML snippet with Tailwind CSS classes to convert it directly into a visual canvas element:
              </p>
              <textarea
                value={pasteInput}
                onChange={(e) => setPasteInput(e.target.value)}
                placeholder={'<button className="flex items-center bg-[#ea580c] rounded-xl p-4">\n  <span>Get Started</span>\n</button>'}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg p-3 font-mono text-xs text-zinc-200 focus:outline-none focus:border-orange-500 resize-none"
              />
              <button
                onClick={handleImportJsx}
                className="flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-500 text-white font-medium text-xs py-2 rounded-lg transition"
              >
                <Plus className="h-4 w-4" />
                <span>Add Component to Canvas</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
