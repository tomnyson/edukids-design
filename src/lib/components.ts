import { ComponentNode, DescendantOverride, FrameNode, PenNode } from '../types/pen-ast';
import { Point } from './node-ops';
import { cloneWithNewIds } from './canvas-editing';

/** A component master: a frame marked reusable, whose content every instance renders */
export function isMaster(node: PenNode): node is FrameNode {
  return node.type === 'frame' && node.reusable === true;
}

const childrenOf = (node: PenNode): PenNode[] => ('children' in node && node.children ? node.children : []);

/** Every master in the tree, nested ones included, in tree order */
export function listMasters(nodes: PenNode[]): FrameNode[] {
  return nodes.flatMap((node) => [...(isMaster(node) ? [node] : []), ...listMasters(childrenOf(node))]);
}

export function findMaster(nodes: PenNode[], id: string): FrameNode | undefined {
  return listMasters(nodes).find((master) => master.id === id);
}

/** A new instance of `master` at `point`, sized like the master */
export function createInstance(master: FrameNode, id: string, point: Point): ComponentNode {
  return {
    id,
    type: 'component',
    name: master.name,
    componentId: master.id,
    x: point.x,
    y: point.y,
    width: master.width,
    height: master.height,
  };
}

/** Instance keys that say which master to show rather than how it looks */
const INSTANCE_ONLY = new Set(['id', 'type', 'componentId', 'descendants', 'children']);

type Descendants = NonNullable<ComponentNode['descendants']>;

/** App keys that come from one pen.dev field: setting one of them replaces the others */
const LINKED_KEYS: readonly (readonly string[])[] = [
  ['width', 'widthSizing'],
  ['height', 'heightSizing'],
  ['strokeWidth', 'strokeWidths'],
  ['cornerRadius', 'cornerRadii'],
  ['layout', 'flexDirection'],
  ['fill', 'src', 'fit'],
];

/** `base` with `patch` on top, linked keys replaced as a group */
function overlay<T extends object>(base: T, patch: object): T {
  const cleared = LINKED_KEYS.filter((group) => group.some((key) => key in patch)).flat();
  const kept = Object.fromEntries(Object.entries(base).filter(([key]) => !cleared.includes(key)));
  return { ...kept, ...patch } as T;
}

/** The override for `node`: by its id, else by its name */
function overrideFor(node: PenNode, descendants: Descendants): DescendantOverride | undefined {
  return descendants[node.id] ?? (node.name !== undefined ? descendants[node.name] : undefined);
}

/** `node` with its override: merged in, or a whole new node when the override has a type */
function applyOverride(node: PenNode, override: DescendantOverride | undefined): PenNode {
  if (!override) return node;
  if (override.type === undefined) return overlay(node, { ...override, id: node.id });
  const replacement = { ...override, id: node.id } as PenNode;
  return replacement.type === 'frame' && !replacement.children ? { ...replacement, children: [] } : replacement;
}

/** Overrides keyed "inner/…" in `descendants`, re-keyed for the nested instance `inner` */
function nestedDescendants(innerId: string, descendants: Descendants): Descendants {
  const prefix = `${innerId}/`;
  return Object.fromEntries(
    Object.entries(descendants)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => [key.slice(prefix.length), value])
  );
}

/**
 * The frame an instance shows: the master's content at the instance's place,
 * with every field the instance sets and its `descendants` overrides applied.
 * Child ids get the instance id as a prefix so they stay unique on the page.
 * Null when the master is missing or already being expanded (a loop).
 */
export function resolveInstance(
  instance: ComponentNode,
  docNodes: PenNode[],
  seen: ReadonlySet<string> = new Set()
): FrameNode | null {
  const master = findMaster(docNodes, instance.componentId);
  if (!master || seen.has(master.id)) return null;
  const { reusable: _reusable, ...content } = master;
  const own = Object.fromEntries(
    Object.entries(instance).filter(([key, value]) => !INSTANCE_ONLY.has(key) && value !== undefined)
  );
  return {
    ...overlay(content, own),
    id: instance.id,
    children: expandInstances(
      master.children,
      docNodes,
      new Set([...seen, master.id]),
      instance.id,
      instance.descendants ?? {}
    ),
  };
}

/**
 * `nodes` with every instance replaced by the frame it shows, for export.
 * Instances that cannot be resolved are dropped. With `prefix`, every id is
 * prefixed (the nodes are a copy of a master's content) and `descendants`
 * holds the enclosing instance's overrides for them.
 */
export function expandInstances(
  nodes: PenNode[],
  docNodes: PenNode[],
  seen: ReadonlySet<string> = new Set(),
  prefix?: string,
  descendants: Descendants = {}
): PenNode[] {
  return nodes.flatMap((original): PenNode[] => {
    const node = applyOverride(original, overrideFor(original, descendants));
    const id = prefix ? `${prefix}-${original.id}` : original.id;
    if (node.type === 'component') {
      const inner = { ...(node.descendants ?? {}), ...nestedDescendants(original.id, descendants) };
      const resolved = resolveInstance({ ...node, id, descendants: inner }, docNodes, seen);
      return resolved ? [resolved] : [];
    }
    if (!('children' in node) || !node.children) return [prefix ? ({ ...node, id } as PenNode) : node];
    const children = expandInstances(node.children, docNodes, seen, prefix, descendants);
    return [{ ...node, id, children } as PenNode];
  });
}

const hasInstances = (nodes: PenNode[]): boolean =>
  nodes.some((node) => node.type === 'component' || hasInstances(childrenOf(node)));

/**
 * After an edit, instances whose master was removed become plain frames with
 * the master's content as it was in `before`, keeping their own id. Returns
 * `after` itself when nothing needs detaching.
 */
export function detachOrphans(before: PenNode[], after: PenNode[], makeId: () => string): PenNode[] {
  if (!hasInstances(after)) return after;
  const masterIds = new Set(listMasters(after).map((master) => master.id));
  let changed = false;
  const walk = (nodes: PenNode[]): PenNode[] =>
    nodes.map((node) => {
      if (node.type === 'component') {
        if (masterIds.has(node.componentId)) return node;
        const resolved = resolveInstance(node, before);
        if (!resolved) return node;
        changed = true;
        const detached = cloneWithNewIds(resolved, makeId) as FrameNode;
        return { ...detached, id: node.id };
      }
      if (!('children' in node) || !node.children) return node;
      const children = walk(node.children);
      return children.some((child, i) => child !== node.children![i]) ? ({ ...node, children } as PenNode) : node;
    });
  const result = walk(after);
  return changed ? result : after;
}

/** Masters whose content (directly or through nested instances) includes an instance of `masterId` */
function mastersReachableFrom(nodes: PenNode[], masterId: string, found: Set<string> = new Set()): Set<string> {
  if (found.has(masterId)) return found;
  found.add(masterId);
  const master = findMaster(nodes, masterId);
  const visit = (list: PenNode[]) =>
    list.forEach((node) => {
      if (node.type === 'component') mastersReachableFrom(nodes, node.componentId, found);
      visit(childrenOf(node));
    });
  if (master) visit(master.children);
  return found;
}

/** Ids of `id` and every node containing it, innermost first; empty when `id` is not in the tree */
function ancestry(nodes: PenNode[], id: string): string[] {
  for (const node of nodes) {
    if (node.id === id) return [id];
    const inner = ancestry(childrenOf(node), id);
    if (inner.length > 0) return [...inner, node.id];
  }
  return [];
}

/** True when an instance of `masterId` inside `parentId` would make a master contain itself */
export function wouldNest(nodes: PenNode[], masterId: string, parentId: string | null): boolean {
  if (!parentId) return false;
  const reachable = mastersReachableFrom(nodes, masterId);
  return ancestry(nodes, parentId).some((id) => reachable.has(id));
}

/**
 * True when `node` can go inside `parentId` as it is: every instance in it has
 * a master in `docNodes` and none would end up inside its own master
 */
export function instancesFit(node: PenNode, docNodes: PenNode[], parentId: string | null): boolean {
  if (node.type === 'component') {
    return findMaster(docNodes, node.componentId) !== undefined && !wouldNest(docNodes, node.componentId, parentId);
  }
  return childrenOf(node).every((child) => instancesFit(child, docNodes, parentId));
}
