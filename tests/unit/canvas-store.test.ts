import { describe, it, expect, beforeEach } from 'vitest';
import { ClipboardEntry, useDesignStore } from '../../src/store/useDesignStore';
import { activateTab, createTab } from '../../src/store/document-tabs';
import { ComponentNode, FrameNode, PenNode } from '../../src/types/pen-ast';

describe('Design State Store', () => {
  beforeEach(() => {
    // Reset state before each test
    const tab = createTab({ version: '2.13', children: [] }, 'untitled.pen');
    useDesignStore.setState({
      tabs: [tab],
      activeTabId: tab.id,
      documentName: tab.name,
      isDirty: false,
      fileHandle: null,
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

  it('should configure parallel agents', () => {
    const store = useDesignStore.getState();
    store.setParallelConfig(3, 'side-by-side');
    expect(useDesignStore.getState().parallelAgentsCount).toBe(3);
    expect(useDesignStore.getState().parallelMode).toBe('side-by-side');

    store.setParallelConfig(4, 'split');
    expect(useDesignStore.getState().parallelAgentsCount).toBe(4);
    expect(useDesignStore.getState().parallelMode).toBe('split');
  });

  describe('appendGeneratedDesigns', () => {
    const design = (name: string): FrameNode => ({
      id: `gen-${name}`,
      type: 'frame',
      name,
      width: 400,
      height: 300,
      children: [],
    });

    it('appends designs beside existing content as one undoable step', () => {
      const store = useDesignStore.getState();
      store.addNode({ type: 'frame', name: 'Mine', x: 0, y: 0, width: 200, height: 100 });

      const ok = store.appendGeneratedDesigns(store.activeTabId, [design('A'), design('B')], 'row');

      const state = useDesignStore.getState();
      expect(ok).toBe(true);
      expect(state.document.children.map((n) => n.name)).toEqual(['Mine', 'A', 'B']);
      expect(state.document.children[1].x).toBe(280);
      expect(state.isDirty).toBe(true);

      state.undo();
      expect(useDesignStore.getState().document.children.map((n) => n.name)).toEqual(['Mine']);
    });

    it('writes into the tab that started the request after the user switched away', () => {
      const store = useDesignStore.getState();
      const originTabId = store.activeTabId;
      store.createNewDocument();
      const otherTabId = useDesignStore.getState().activeTabId;

      useDesignStore.getState().appendGeneratedDesigns(originTabId, [design('A')], 'row');

      let state = useDesignStore.getState();
      expect(state.activeTabId).toBe(otherTabId);
      expect(state.document.children).toHaveLength(0);
      const origin = state.tabs.find((t) => t.id === originTabId)!;
      expect(origin.document.children.map((n) => n.name)).toEqual(['A']);
      expect(origin.isDirty).toBe(true);

      // Switching back restores it, and undo removes the generated design
      state.switchTab(originTabId);
      state = useDesignStore.getState();
      expect(state.document.children).toHaveLength(1);
      state.undo();
      expect(useDesignStore.getState().document.children).toHaveLength(0);
    });

    it('reports failure when the target tab was closed', () => {
      const ok = useDesignStore.getState().appendGeneratedDesigns('tab-gone', [design('A')], 'row');
      expect(ok).toBe(false);
    });
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
    // New documents open in their own tab, so the name gets the next free counter
    expect(state.documentName).toBe('untitled-2.pen');
    expect(state.tabs).toHaveLength(2);
    expect(state.history).toHaveLength(1);
    expect(state.historyIndex).toBe(0);
    expect(state.toastMessage).toContain('Canvas trống');
  });
});

describe('context menu actions', () => {
  const rect = (id: string, x = 0, y = 0): PenNode => ({ id, type: 'rect', x, y, width: 40, height: 40 });

  function load(children: PenNode[], selectedNodeIds: string[] = [], clipboard: ClipboardEntry[] = []) {
    const doc = { version: '2.13', children };
    const tab = createTab(doc, 'untitled.pen');
    useDesignStore.setState({
      tabs: [tab],
      activeTabId: tab.id,
      document: doc,
      history: [{ document: doc }],
      historyIndex: 0,
      selectedNodeIds,
      clipboard,
    });
  }

  const state = () => useDesignStore.getState();
  const top = () => state().document.children;

  it('reorderSelection(front) moves the selected node last and is one undo step', () => {
    load([rect('a'), rect('b'), rect('c')], ['a']);
    state().reorderSelection('front');
    expect(top().map((n) => n.id)).toEqual(['b', 'c', 'a']);
    state().undo();
    expect(top().map((n) => n.id)).toEqual(['a', 'b', 'c']);
  });

  it('groupSelection(group) wraps siblings and selects the wrapper', () => {
    load([rect('a'), rect('b', 100)], ['a', 'b']);
    expect(state().groupSelection('group')).toBe(true);
    const wrapperId = state().selectedNodeIds[0];
    expect(state().selectedNodeIds).toEqual([wrapperId]);
    expect((top()[0] as FrameNode).children).toHaveLength(2);
    expect(top()[0].id).toBe(wrapperId);
  });

  it('groupSelection refuses nodes with different parents', () => {
    const frame: FrameNode = { id: 'f', type: 'frame', x: 0, y: 0, width: 200, height: 200, children: [rect('b')] };
    load([rect('a'), frame], ['a', 'b']);
    expect(state().groupSelection('group')).toBe(false);
    expect(state().historyIndex).toBe(0);
  });

  it('ungroupSelection lifts children and selects them', () => {
    const frame: FrameNode = { id: 'f', type: 'frame', x: 50, y: 50, width: 200, height: 200, children: [rect('c', 10, 10)] };
    load([frame], ['f']);
    state().ungroupSelection();
    expect(top()).toEqual([expect.objectContaining({ id: 'c', x: 60, y: 60 })]);
    expect(state().selectedNodeIds).toEqual(['c']);
  });

  it('ungroupSelection on a rect changes nothing', () => {
    load([rect('a')], ['a']);
    state().ungroupSelection();
    expect(state().historyIndex).toBe(0);
  });

  it('addFlexLayout sets layout flex on the selected frame', () => {
    const frame: FrameNode = { id: 'f', type: 'frame', x: 0, y: 0, width: 300, height: 100, children: [rect('a', 10, 10), rect('b', 80, 10)] };
    load([frame], ['f']);
    state().addFlexLayout();
    expect(top()[0]).toMatchObject({ layout: 'flex', flexDirection: 'row' });
  });

  it('removeFlexLayout sets layout none and keeps child positions', () => {
    const frame: FrameNode = {
      id: 'f', type: 'frame', x: 0, y: 0, width: 300, height: 100, layout: 'flex', children: [rect('a', 10, 10), rect('b', 80, 10)],
    };
    load([frame], ['f']);
    state().removeFlexLayout();
    const result = top()[0] as FrameNode;
    expect(result.layout).toBe('none');
    expect(result.children.map((c) => c.x)).toEqual([10, 80]);
  });

  it('flipSelection(x) toggles flipX on and off', () => {
    load([rect('a')], ['a']);
    state().flipSelection('x');
    expect(top()[0].flipX).toBe(true);
    state().flipSelection('x');
    expect(top()[0].flipX).toBe(false);
  });

  it('pasteAt places the copy at the point inside the given frame', () => {
    const frame: FrameNode = { id: 'f', type: 'frame', x: 0, y: 0, width: 300, height: 300, children: [] };
    load([frame, rect('a', 500, 500)], [], [{ node: rect('a', 500, 500), parentId: null }]);
    state().pasteAt('f', { x: 30, y: 40 });
    const pasted = (top()[0] as FrameNode).children;
    expect(pasted).toHaveLength(1);
    expect(pasted[0]).toMatchObject({ x: 30, y: 40 });
    expect(pasted[0].id).not.toBe('a');
    expect(state().selectedNodeIds).toEqual([pasted[0].id]);
  });

  it('pasteToReplace swaps the selected node for the clipboard node', () => {
    load([rect('t', 70, 80)], ['t'], [{ node: rect('src', 0, 0), parentId: null }]);
    state().pasteToReplace();
    expect(top().some((n) => n.id === 't')).toBe(false);
    expect(top()[0]).toMatchObject({ x: 70, y: 80 });
  });

  it('pasteToReplace with two selected nodes does nothing', () => {
    load([rect('a'), rect('b')], ['a', 'b'], [{ node: rect('src'), parentId: null }]);
    state().pasteToReplace();
    expect(state().historyIndex).toBe(0);
  });

  describe('components', () => {
    const frame = (id: string, children: PenNode[], extra: Partial<FrameNode> = {}): FrameNode => ({
      id,
      type: 'frame',
      name: id,
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      children,
      ...extra,
    });
    const master = () => frame('m', [rect('label', 4, 4)], { reusable: true, fill: '#111111' });
    const inst = (id: string, extra: Partial<ComponentNode> = {}): ComponentNode => ({
      id,
      type: 'component',
      componentId: 'm',
      x: 400,
      y: 0,
      width: 200,
      height: 100,
      ...extra,
    });

    it('createComponent marks a single selected frame reusable in one undo step', () => {
      load([frame('f', [rect('a')])], ['f']);
      state().createComponent();
      expect((top()[0] as FrameNode).reusable).toBe(true);
      expect(state().historyIndex).toBe(1);
    });

    it('createComponent wraps other selections in a frame and marks the wrapper', () => {
      load([rect('a'), rect('b', 100)], ['a', 'b']);
      state().createComponent();
      const wrapper = top()[0] as FrameNode;
      expect(wrapper).toMatchObject({ type: 'frame', reusable: true });
      expect(wrapper.children.map((n) => n.id)).toEqual(['a', 'b']);
      expect(state().selectedNodeIds).toEqual([wrapper.id]);
    });

    it('createComponent on an existing master changes nothing', () => {
      load([master()], ['m']);
      state().createComponent();
      expect(state().historyIndex).toBe(0);
    });

    it('insertInstance adds an instance of the master and selects it', () => {
      load([master()]);
      const id = state().insertInstance('m', { x: 300, y: 20 });
      expect(top()[1]).toMatchObject({ id, type: 'component', componentId: 'm', x: 300, y: 20, width: 200, height: 100 });
      expect(state().selectedNodeIds).toEqual([id]);
    });

    it('insertInstance refuses to put a master inside itself', () => {
      load([master()]);
      expect(state().insertInstance('m', { parentId: 'm', x: 0, y: 0 })).toBeNull();
      expect(state().historyIndex).toBe(0);
    });

    it('detachSelection turns the selected instance into a plain frame copy', () => {
      load([master(), inst('i')], ['i']);
      state().detachSelection();
      const detached = top()[1] as FrameNode;
      expect(detached).toMatchObject({ id: 'i', type: 'frame', x: 400, fill: '#111111' });
      expect(detached.reusable).toBeUndefined();
      expect(detached.children[0].id).not.toBe('label');
    });

    it('deleting a master detaches its instances', () => {
      load([master(), inst('i')], ['m']);
      state().deleteSelectedNodes();
      expect(top()).toHaveLength(1);
      expect(top()[0]).toMatchObject({ id: 'i', type: 'frame', fill: '#111111' });
    });

    it('pasting an instance in the same document keeps it an instance', () => {
      load([master(), inst('i')], ['i']);
      state().copySelection();
      state().pasteClipboard();
      expect(top()[2]).toMatchObject({ type: 'component', componentId: 'm', x: 416 });
    });

    it('pasting an instance inside its own master pastes a plain copy instead', () => {
      load([master(), inst('i')], ['i']);
      state().copySelection();
      state().pasteAt('m', { x: 10, y: 10 });
      const pasted = (top()[0] as FrameNode).children[1];
      expect(pasted).toMatchObject({ type: 'frame', x: 10, y: 10, fill: '#111111' });
    });

    it('pasting an instance into a document without its master pastes a plain copy', () => {
      load([master(), inst('i')], ['i']);
      state().copySelection();
      load([frame('page', [])], [], state().clipboard);
      state().pasteClipboard();
      expect(top()[1]).toMatchObject({ type: 'frame', x: 416, fill: '#111111' });
      expect((top()[1] as FrameNode).children).toHaveLength(1);
    });
  });
});

describe('home view', () => {
  const frame: FrameNode = { id: 'F1', type: 'frame', name: 'Page', x: 0, y: 0, width: 100, height: 100, children: [] };

  beforeEach(() => {
    const tab = createTab({ version: '2.13', children: [] }, 'untitled.pen');
    useDesignStore.setState({
      tabs: [tab],
      ...activateTab(tab),
      history: [{ document: tab.document }],
      historyIndex: 0,
      view: 'home',
    });
  });

  it('opens the editor when a document is created, loaded or a tab is picked', () => {
    useDesignStore.getState().createNewDocument();
    expect(useDesignStore.getState().view).toBe('editor');

    useDesignStore.getState().showHome();
    expect(useDesignStore.getState().view).toBe('home');
    useDesignStore.getState().loadDocument({ version: '2.13', children: [frame] }, 'a.pen');
    expect(useDesignStore.getState().view).toBe('editor');

    const { tabs, activeTabId } = useDesignStore.getState();
    useDesignStore.getState().showHome();
    useDesignStore.getState().switchTab(tabs.find((t) => t.id !== activeTabId)!.id);
    expect(useDesignStore.getState().view).toBe('editor');
  });

  it('opens the editor when picking the tab that is already active', () => {
    useDesignStore.getState().switchTab(useDesignStore.getState().activeTabId);
    expect(useDesignStore.getState().view).toBe('editor');
  });

  it('starts a design in the untouched blank tab instead of adding another', () => {
    const before = useDesignStore.getState().tabs;
    const tabId = useDesignStore.getState().startBlankDesign();
    const state = useDesignStore.getState();
    expect(state.view).toBe('editor');
    expect(state.tabs).toHaveLength(before.length);
    expect(tabId).toBe(state.activeTabId);
  });

  it('starts a design in a new tab when the active one has content', () => {
    useDesignStore.getState().addNode({ type: 'frame', name: 'Busy', width: 10, height: 10 });
    const before = useDesignStore.getState();
    const tabId = useDesignStore.getState().startBlankDesign();
    const state = useDesignStore.getState();
    expect(state.tabs).toHaveLength(before.tabs.length + 1);
    expect(tabId).not.toBe(before.activeTabId);
    expect(state.document.children).toHaveLength(0);
    expect(state.view).toBe('editor');
  });

  it('keeps the context attached on Home when the design goes to a new tab', () => {
    useDesignStore.getState().addNode({ type: 'frame', name: 'Busy', width: 10, height: 10 });
    const shot = { id: 'shot', type: 'image' as const, name: 'shot.png', previewUrl: 'data:image/png;base64,AA==' };
    useDesignStore.setState({ contextAttachments: [shot] });
    useDesignStore.getState().startBlankDesign();
    expect(useDesignStore.getState().contextAttachments).toEqual([shot]);
  });
});
