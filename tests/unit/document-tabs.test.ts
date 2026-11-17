import { describe, it, expect, beforeEach } from 'vitest';
import { useDesignStore, BLANK_PEN_DOC } from '../../src/store/useDesignStore';
import { createTab, uniqueUntitledName, findTabWithSameFile } from '../../src/store/document-tabs';

function resetStore() {
  const tab = createTab(BLANK_PEN_DOC, 'untitled.pen');
  useDesignStore.setState({
    tabs: [tab],
    activeTabId: tab.id,
    documentName: tab.name,
    document: tab.document,
    history: tab.history,
    historyIndex: 0,
    selectedNodeIds: [],
    viewport: { x: 40, y: 40, zoom: 1 },
    isDirty: false,
    fileHandle: null,
  });
}

describe('uniqueUntitledName', () => {
  it('returns untitled.pen when the name is free', () => {
    expect(uniqueUntitledName([])).toBe('untitled.pen');
    expect(uniqueUntitledName(['landing.pen'])).toBe('untitled.pen');
  });

  it('appends the next free counter when untitled names are taken', () => {
    expect(uniqueUntitledName(['untitled.pen'])).toBe('untitled-2.pen');
    expect(uniqueUntitledName(['untitled.pen', 'untitled-2.pen'])).toBe('untitled-3.pen');
  });
});

describe('Document tabs', () => {
  beforeEach(resetStore);

  it('opens a new tab without discarding the current document', () => {
    const store = useDesignStore.getState();
    store.addNode({ type: 'frame', name: 'Kept Frame' });
    const firstTabId = useDesignStore.getState().activeTabId;

    store.createNewDocument();

    const state = useDesignStore.getState();
    expect(state.tabs).toHaveLength(2);
    expect(state.activeTabId).not.toBe(firstTabId);
    expect(state.document.children).toHaveLength(0);
    expect(state.documentName).toBe('untitled-2.pen');

    const firstTab = state.tabs.find((t) => t.id === firstTabId);
    expect(firstTab?.document.children[0].name).toBe('Kept Frame');
  });

  it('restores document, undo history and dirty flag when switching back', () => {
    const store = useDesignStore.getState();
    store.addNode({ type: 'rect', name: 'A' });
    store.addNode({ type: 'rect', name: 'B' });
    const firstTabId = useDesignStore.getState().activeTabId;

    store.createNewDocument();
    useDesignStore.getState().switchTab(firstTabId);

    const state = useDesignStore.getState();
    expect(state.document.children.map((n) => n.name)).toEqual(['A', 'B']);
    expect(state.historyIndex).toBe(2);
    expect(state.isDirty).toBe(true);

    state.undo();
    expect(useDesignStore.getState().document.children).toHaveLength(1);
  });

  it('marks the document dirty on edit and clean after save', () => {
    const store = useDesignStore.getState();
    expect(store.isDirty).toBe(false);

    store.addNode({ type: 'rect' });
    expect(useDesignStore.getState().isDirty).toBe(true);

    const { activeTabId, document } = useDesignStore.getState();
    useDesignStore.getState().markSaved(activeTabId, 'landing.pen', null, document);
    const state = useDesignStore.getState();
    expect(state.isDirty).toBe(false);
    expect(state.documentName).toBe('landing.pen');
    expect(state.tabs.find((t) => t.id === state.activeTabId)?.name).toBe('landing.pen');
  });

  it('stays dirty when the document changed while the save was in flight', () => {
    useDesignStore.getState().addNode({ type: 'rect' });
    const { activeTabId, document: savedDoc } = useDesignStore.getState();
    useDesignStore.getState().addNode({ type: 'rect' });

    useDesignStore.getState().markSaved(activeTabId, 'landing.pen', null, savedDoc);

    expect(useDesignStore.getState().isDirty).toBe(true);
  });

  it('marks the right tab saved when the user switched tabs during the save', () => {
    useDesignStore.getState().addNode({ type: 'rect' });
    const { activeTabId: savedTabId, document: savedDoc } = useDesignStore.getState();
    useDesignStore.getState().createNewDocument();
    useDesignStore.getState().addNode({ type: 'rect' });

    useDesignStore.getState().markSaved(savedTabId, 'landing.pen', null, savedDoc);

    const state = useDesignStore.getState();
    expect(state.documentName).toBe('untitled-2.pen');
    expect(state.isDirty).toBe(true);
    const savedTab = state.tabs.find((t) => t.id === savedTabId);
    expect(savedTab?.name).toBe('landing.pen');
    expect(savedTab?.isDirty).toBe(false);
  });

  it('closes the active tab and activates its neighbour', () => {
    const store = useDesignStore.getState();
    const firstTabId = store.activeTabId;
    store.createNewDocument();
    const secondTabId = useDesignStore.getState().activeTabId;

    useDesignStore.getState().closeTab(secondTabId);

    const state = useDesignStore.getState();
    expect(state.tabs).toHaveLength(1);
    expect(state.activeTabId).toBe(firstTabId);
  });

  it('closing an inactive tab keeps the active document untouched', () => {
    const store = useDesignStore.getState();
    const firstTabId = store.activeTabId;
    store.createNewDocument();
    useDesignStore.getState().addNode({ type: 'rect', name: 'Active' });
    const activeId = useDesignStore.getState().activeTabId;

    useDesignStore.getState().closeTab(firstTabId);

    const state = useDesignStore.getState();
    expect(state.tabs).toHaveLength(1);
    expect(state.activeTabId).toBe(activeId);
    expect(state.document.children[0].name).toBe('Active');
  });

  it('closing the last tab leaves one fresh blank tab', () => {
    const store = useDesignStore.getState();
    store.addNode({ type: 'rect' });

    useDesignStore.getState().closeTab(store.activeTabId);

    const state = useDesignStore.getState();
    expect(state.tabs).toHaveLength(1);
    expect(state.document.children).toHaveLength(0);
    expect(state.isDirty).toBe(false);
  });

  it('opens a file into the pristine active tab instead of adding a tab', () => {
    const doc = { ...BLANK_PEN_DOC, children: [{ id: 'r1', type: 'rect' as const, name: 'Loaded' }] };

    useDesignStore.getState().loadDocument(doc, 'landing.pen');

    const state = useDesignStore.getState();
    expect(state.tabs).toHaveLength(1);
    expect(state.documentName).toBe('landing.pen');
    expect(state.document.children[0].name).toBe('Loaded');
    expect(state.isDirty).toBe(false);
  });

  it('opens a file into a new tab when the active tab has work in it', () => {
    useDesignStore.getState().addNode({ type: 'rect', name: 'Work' });
    const doc = { ...BLANK_PEN_DOC, children: [] };

    useDesignStore.getState().loadDocument(doc, 'other.pen');

    const state = useDesignStore.getState();
    expect(state.tabs).toHaveLength(2);
    expect(state.documentName).toBe('other.pen');
    expect(state.tabs[0].document.children[0].name).toBe('Work');
  });
});

describe('findTabWithSameFile', () => {
  const handleFor = (path: string) =>
    ({
      name: path,
      isSameEntry: async (other: { name: string }) => other.name === path,
    }) as unknown as FileSystemFileHandle;

  it('finds the tab already holding the opened file', async () => {
    const tabs = [
      { id: 'a', fileHandle: null },
      { id: 'b', fileHandle: handleFor('/x/landing.pen') },
    ];
    await expect(findTabWithSameFile(tabs, handleFor('/x/landing.pen'))).resolves.toBe('b');
  });

  it('returns null when the file is not open or has no handle', async () => {
    const tabs = [{ id: 'a', fileHandle: handleFor('/x/other.pen') }];
    await expect(findTabWithSameFile(tabs, handleFor('/x/landing.pen'))).resolves.toBeNull();
    await expect(findTabWithSameFile(tabs, null)).resolves.toBeNull();
  });
});
