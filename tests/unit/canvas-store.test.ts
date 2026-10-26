import { describe, it, expect, beforeEach } from 'vitest';
import { useDesignStore } from '../../src/store/useDesignStore';

describe('Design State Store', () => {
  beforeEach(() => {
    // Reset state before each test
    useDesignStore.setState({
      selectedNodeIds: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      activeTool: 'select',
      document: {
        version: '2.13',
        children: [],
      },
      history: [{ document: { version: '2.13', children: [] } }],
      historyIndex: 0,
    });
  });

  it('should add a new frame and select it', () => {
    const store = useDesignStore.getState();
    const newId = store.addNode({
      type: 'frame',
      name: 'Card Frame',
      width: 250,
      height: 150,
    });

    const updated = useDesignStore.getState();
    expect(updated.document.children).toHaveLength(1);
    expect(updated.document.children[0].id).toBe(newId);
    expect(updated.document.children[0].name).toBe('Card Frame');
    expect(updated.selectedNodeIds).toContain(newId);
  });

  it('should update node properties cleanly', () => {
    const store = useDesignStore.getState();
    const id = store.addNode({
      type: 'rect',
      name: 'Button',
      fill: '#10b981',
    });

    store.updateNode(id, { fill: '#ef4444', width: 200 });

    const updated = useDesignStore.getState();
    const node = updated.document.children[0];
    expect(node.fill).toBe('#ef4444');
    expect(node.width).toBe(200);
  });

  it('should support undo and redo operations', () => {
    const store = useDesignStore.getState();
    const id = store.addNode({
      type: 'rect',
      fill: '#ffffff',
    });

    store.updateNode(id, { fill: '#000000' });
    expect(useDesignStore.getState().document.children[0].fill).toBe('#000000');

    // Undo
    useDesignStore.getState().undo();
    expect(useDesignStore.getState().document.children[0].fill).toBe('#ffffff');

    // Redo
    useDesignStore.getState().redo();
    expect(useDesignStore.getState().document.children[0].fill).toBe('#000000');
  });

  it('should delete selected nodes', () => {
    const store = useDesignStore.getState();
    const id1 = store.addNode({ type: 'rect', name: 'Item 1' });
    const id2 = store.addNode({ type: 'rect', name: 'Item 2' });

    expect(useDesignStore.getState().document.children).toHaveLength(2);

    store.selectNode(id1);
    store.deleteSelectedNodes();

    const updated = useDesignStore.getState();
    expect(updated.document.children).toHaveLength(1);
    expect(updated.document.children[0].id).toBe(id2);
  });

  it('should manage context attachments', () => {
    const store = useDesignStore.getState();
    store.addContextAttachment({
      id: 'att-1',
      type: 'style',
      name: 'Style: Neon Glass',
    });
    store.addContextAttachment({
      id: 'att-2',
      type: 'skill',
      name: 'Skill: WCAG AA',
    });

    let state = useDesignStore.getState();
    expect(state.contextAttachments).toHaveLength(2);
    expect(state.contextAttachments[0].name).toBe('Style: Neon Glass');

    store.removeContextAttachment('att-1');
    state = useDesignStore.getState();
    expect(state.contextAttachments).toHaveLength(1);
    expect(state.contextAttachments[0].id).toBe('att-2');

    store.clearContextAttachments();
    state = useDesignStore.getState();
    expect(state.contextAttachments).toHaveLength(0);
  });

  it('should configure parallel agents and scale variant generation', () => {
    const store = useDesignStore.getState();
    
    // Set to 3x parallel side-by-side
    store.setParallelConfig(3, 'side-by-side');
    expect(useDesignStore.getState().parallelAgentsCount).toBe(3);
    expect(useDesignStore.getState().parallelMode).toBe('side-by-side');

    store.generateWebVariants('SaaS Landing Page');
    let state = useDesignStore.getState();
    expect(state.document.children).toHaveLength(3);
    expect(state.document.children[0].name).toContain('1. Neon Glass');

    // Set to 4x parallel split work
    store.setParallelConfig(4, 'split');
    store.generateWebVariants('E-commerce');
    state = useDesignStore.getState();
    expect(state.document.children).toHaveLength(4);
    expect(state.document.children[0].name).toBe('1. Hero & Navigation');
    expect(state.document.children[1].name).toBe('2. Product Catalog');
  });

  it('should configure reasoning effort and selected model', () => {
    const store = useDesignStore.getState();

    store.setReasoningEffort('very_high');
    expect(useDesignStore.getState().reasoningEffort).toBe('very_high');

    store.setSelectedModel('pen.dev Pro - DeepSeek V4.1 Flash');
    expect(useDesignStore.getState().selectedModel).toBe('pen.dev Pro - DeepSeek V4.1 Flash');
  });

  it('should create a new completely blank document with 0 frames', () => {
    const store = useDesignStore.getState();

    // Populate with some nodes first
    store.addNode({ type: 'frame', name: 'Old Frame' });
    store.addNode({ type: 'rect', name: 'Old Rect' });
    store.addContextAttachment({ id: 'att-1', type: 'file', name: 'test.md' });
    expect(useDesignStore.getState().document.children).toHaveLength(2);
    expect(useDesignStore.getState().contextAttachments).toHaveLength(1);

    // Trigger createNewDocument
    store.createNewDocument();

    const state = useDesignStore.getState();
    // Canvas must be completely blank, no frames created
    expect(state.document.children).toHaveLength(0);
    expect(state.selectedNodeIds).toHaveLength(0);
    expect(state.contextAttachments).toHaveLength(0);
    expect(state.documentName).toBe('untitled.pen');
    expect(state.history).toHaveLength(1);
    expect(state.historyIndex).toBe(0);
    expect(state.toastMessage).toContain('Canvas trống');
  });
});
