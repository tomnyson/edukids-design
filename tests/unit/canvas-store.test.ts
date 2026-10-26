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
});
