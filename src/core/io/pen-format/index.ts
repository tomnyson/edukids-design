import { DesignVariable, PenDocument, PenNode, PenSourceNode } from '../../../types/pen-ast';
import { APP_KEYS, CODECS, Json, PEN_KEYS, ReadContext, WriteContext } from './codecs';
import { parseRawPenDocument, RawPenDocument } from './raw-schema';
import { createVariableResolver, VariableResolver } from './variables';

export type { RawPenDocument } from './raw-schema';

/** App-only keys that never go into a file */
const APP_ONLY = new Set(['penSource', 'overrides']);

/** Signs of a file this app wrote before it spoke pen.dev's vocabulary */
const LEGACY_TYPES = new Set(['rect', 'component', 'image']);
const LEGACY_KEYS = ['flexDirection', 'visible', 'componentId', 'overrides', 'src'];
const LEGACY_VALUES: Record<string, ReadonlySet<unknown>> = {
  layout: new Set(['flex', 'grid']),
  justifyContent: new Set(['between', 'around']),
};

const isObject = (value: unknown): value is Json => !!value && typeof value === 'object' && !Array.isArray(value);

function withoutChildren(raw: Json): Json {
  const { children: _children, ...rest } = raw;
  return rest;
}

/** The raw node with its children left out; an empty list keeps their place in the key order */
function sourceOf(raw: Json): PenSourceNode {
  return Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, key === 'children' ? [] : value])) as PenSourceNode;
}

function isLegacyNode(raw: Json): boolean {
  if (LEGACY_TYPES.has(String(raw.type))) return true;
  if (LEGACY_KEYS.some((key) => key in raw)) return true;
  if (Object.entries(LEGACY_VALUES).some(([key, values]) => values.has(raw[key]))) return true;
  return Array.isArray(raw.children) && raw.children.some((child) => isObject(child) && isLegacyNode(child));
}

/** JSON with sorted keys and undefined left out, for comparing values */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, inner) =>
    isObject(inner)
      ? Object.fromEntries(
          Object.keys(inner)
            .sort()
            .filter((key) => inner[key] !== undefined)
            .map((key) => [key, inner[key]])
        )
      : inner
  );
}

const sameValue = (a: unknown, b: unknown) => canonical(a) === canonical(b);
const sameOn = (a: Json, b: Json, keys: readonly string[]) => keys.every((key) => sameValue(a[key], b[key]));

const defined = (entries: Json): [string, unknown][] => Object.entries(entries).filter(([, v]) => v !== undefined);

class Reader {
  readonly penSource: Record<string, PenSourceNode> = {};

  constructor(
    private readonly resolve: VariableResolver,
    private readonly legacy: boolean
  ) {}

  /** One node as the app holds it; `record` keeps its raw form for saving */
  node(raw: Json, partial = false, record = !partial && !this.legacy): Json {
    const resolved = this.resolve(withoutChildren(raw)) as Json;
    const ctx: ReadContext = {
      legacy: this.legacy,
      partial,
      readDescendant: (patch) => this.node(patch, patch.type === undefined, false),
    };
    const out: Json = Object.fromEntries(defined(resolved).filter(([key]) => !PEN_KEYS.has(key)));
    for (const codec of CODECS) Object.assign(out, Object.fromEntries(defined(codec.read(resolved, ctx))));
    if (Array.isArray(raw.children)) {
      out.children = raw.children.filter(isObject).map((child) => this.node(child, false, record));
    } else if (out.type === 'frame' && !partial) {
      out.children = [];
    }
    if (record) this.penSource[String(raw.id)] = sourceOf(raw);
    return out;
  }
}

class Writer {
  private readonly reader: Reader;
  private readonly ctx: WriteContext;

  constructor(
    private readonly penSource: Record<string, PenSourceNode>,
    resolve: VariableResolver
  ) {
    this.reader = new Reader(resolve, false);
    this.ctx = {
      writeDescendant: (patch) => this.node(patch, false),
      keepDescendant: (raw, patch) =>
        isObject(raw) && sameValue(this.reader.node(raw, raw.type === undefined, false), patch),
    };
  }

  /** One node in pen.dev's form; an opened node keeps every unchanged field as the file had it */
  node(node: Json, useSource = true): Json {
    const source = useSource && typeof node.id === 'string' ? this.penSource[node.id] : undefined;
    const fields = source ? this.changedFields(node, source) : this.allFields(node);
    const children = this.children(node, source, useSource);
    const order = source ? Object.keys(source) : ['id'];
    const out: Json = {};
    for (const key of order) {
      if (key === 'children') {
        if (children) out.children = children;
      } else if (fields.has(key)) {
        out[key] = fields.get(key);
      }
    }
    fields.forEach((value, key) => {
      if (!(key in out)) out[key] = value;
    });
    if (children && !('children' in out)) out.children = children;
    return out;
  }

  private allFields(node: Json): Map<string, unknown> {
    const fields = new Map<string, unknown>();
    if (node.id !== undefined) fields.set('id', node.id);
    for (const codec of CODECS) defined(codec.write(node, this.ctx)).forEach(([key, v]) => fields.set(key, v));
    defined(node)
      .filter(([key]) => !APP_KEYS.has(key) && !APP_ONLY.has(key) && key !== 'children' && !fields.has(key))
      .forEach(([key, v]) => fields.set(key, v));
    return fields;
  }

  private changedFields(node: Json, source: Json): Map<string, unknown> {
    const before = this.reader.node(source, false, false);
    const fields = new Map<string, unknown>();
    for (const codec of CODECS) {
      if (sameOn(before, node, codec.app)) {
        codec.pen.filter((key) => key in source).forEach((key) => fields.set(key, source[key]));
      } else {
        defined(codec.write(node, this.ctx, source)).forEach(([key, v]) => fields.set(key, v));
      }
    }
    for (const key of Object.keys(source)) {
      if (PEN_KEYS.has(key) || key === 'children') continue;
      if (sameValue(before[key], node[key])) fields.set(key, source[key]);
      else if (node[key] !== undefined) fields.set(key, node[key]);
    }
    defined(node)
      .filter(([key]) => !(key in source) && !APP_KEYS.has(key) && !APP_ONLY.has(key) && key !== 'children')
      .forEach(([key, v]) => fields.set(key, v));
    return fields;
  }

  private children(node: Json, source: Json | undefined, useSource: boolean): Json[] | undefined {
    // A ref shows its master's children; the app may cache them for preview only
    if (node.type === 'component' || !Array.isArray(node.children)) return undefined;
    if (node.children.length === 0 && source && !('children' in source)) return undefined;
    return node.children.filter(isObject).map((child) => this.node(child, useSource));
  }
}

function readVariables(raw: RawPenDocument): Record<string, DesignVariable> | undefined {
  return isObject(raw.variables) ? (raw.variables as Record<string, DesignVariable>) : undefined;
}

/**
 * A .pen file (already JSON-parsed) as the app's document. Accepts pen.dev
 * files and files this app wrote before it used pen.dev's vocabulary.
 */
export function fromPenFile(input: unknown): PenDocument {
  const raw = parseRawPenDocument(input);
  const rawChildren = (raw.children ?? []) as Json[];
  const legacy = raw.version === undefined || raw.version === '2.13' || rawChildren.some(isLegacyNode);
  const reader = new Reader(createVariableResolver(readVariables(raw)), legacy);
  const doc: Json = { version: raw.version ?? '2.13' };
  for (const [key, value] of Object.entries(raw)) {
    doc[key] = key === 'children' ? rawChildren.map((child) => reader.node(child)) : value;
  }
  if (!('children' in doc)) doc.children = [];
  if (Object.keys(reader.penSource).length > 0) doc.penSource = reader.penSource;
  return doc as unknown as PenDocument;
}

/** The app's document as a pen.dev .pen file, ready for JSON.stringify */
export function toPenFile(doc: PenDocument): RawPenDocument {
  const writer = new Writer(doc.penSource ?? {}, createVariableResolver(doc.variables));
  const out: Json = {};
  for (const [key, value] of Object.entries(doc)) {
    if (key === 'penSource' || value === undefined) continue;
    out[key] = key === 'children' ? (value as PenNode[]).map((node) => writer.node(node as unknown as Json)) : value;
  }
  return out as RawPenDocument;
}
