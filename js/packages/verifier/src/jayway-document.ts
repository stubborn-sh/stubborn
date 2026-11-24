import { evaluateJsonPath, readJsonPath } from "@stubborn-sh/stub-server";

/**
 * The parts of Jayway's `DocumentContext` that the JVM's `JsonPathMatcherUtils` uses to strip
 * matcher-covered entries from the expected body: `read` and `delete`.
 *
 * Reading goes through stub-server's Jayway-compatible evaluator. Deleting needs the location of
 * each selected value (its parent and key), which that evaluator does not expose, so the path is
 * split into segments here and walked with locations; filter segments are still evaluated by
 * stub-server, one candidate at a time. A `$` inside such a filter therefore refers to the
 * candidate rather than the document root — a corner the JVM's matcher paths do not rely on.
 */

type Segment =
  | { readonly kind: "members"; readonly names: readonly string[] }
  | { readonly kind: "wildcard" }
  | { readonly kind: "indexes"; readonly indexes: readonly number[] }
  | { readonly kind: "slice"; readonly start?: number; readonly end?: number }
  | { readonly kind: "filter"; readonly source: string }
  | { readonly kind: "scan"; readonly then: Segment };

interface Location {
  readonly value: unknown;
  readonly parent?: Record<string, unknown> | unknown[];
  readonly key?: string | number;
}

/** Jayway `read`: the value, the list for an indefinite path, or null when it is missing. */
export function readPath(root: unknown, path: string): unknown {
  try {
    return readJsonPath(root, path) ?? null;
  } catch {
    return null;
  }
}

/**
 * Jayway `delete`: remove every value the path selects from its parent object or array. Returns
 * false where Jayway throws (the root itself, or a path this helper cannot split).
 */
export function deletePath(root: unknown, path: string): boolean {
  const segments = parse(path);
  if (segments === undefined || segments.length === 0) return false;
  const locations = locate(root, segments);
  const indexes = new Map<unknown[], Set<number>>();
  for (const { parent, key } of locations) {
    if (parent === undefined || key === undefined) continue;
    if (Array.isArray(parent)) {
      const set = indexes.get(parent) ?? new Set<number>();
      set.add(key as number);
      indexes.set(parent, set);
    } else {
      delete parent[key as string];
    }
  }
  for (const [array, set] of indexes) {
    for (const index of [...set].sort((a, b) => b - a)) array.splice(index, 1);
  }
  return true;
}

/**
 * Jayway throws `PathNotFoundException` when a member or index is missing while the path up to
 * it is still definite (no wildcard, filter, scan, slice or union yet), where stub-server's
 * evaluator just selects nothing. True when `path` would throw that way on `root`.
 */
export function missingDefinitePrefix(root: unknown, path: string): boolean {
  const segments = parse(path);
  if (segments === undefined) return false;
  let node: unknown = root;
  for (const segment of segments) {
    if (segment.kind === "members" && segment.names.length === 1) {
      const name = segment.names[0] ?? "";
      if (!isObject(node) || !Object.hasOwn(node, name)) return true;
      node = node[name];
    } else if (segment.kind === "indexes" && segment.indexes.length === 1) {
      const index = segment.indexes[0] ?? 0;
      if (!Array.isArray(node)) return true;
      const resolved = index < 0 ? node.length + index : index;
      if (resolved < 0 || resolved >= node.length) return true;
      node = node[resolved] as unknown;
    } else {
      return false;
    }
  }
  return false;
}

function locate(root: unknown, segments: readonly Segment[]): Location[] {
  let nodes: Location[] = [{ value: root }];
  for (const segment of segments) {
    const next: Location[] = [];
    for (const node of nodes) apply(segment, node, next);
    nodes = next;
  }
  return nodes;
}

function apply(segment: Segment, node: Location, out: Location[]): void {
  const value = node.value;
  switch (segment.kind) {
    case "members":
      if (!isObject(value)) return;
      for (const name of segment.names) {
        if (Object.hasOwn(value, name)) out.push({ value: value[name], parent: value, key: name });
      }
      return;
    case "wildcard":
      children(value, out);
      return;
    case "indexes":
      if (!Array.isArray(value)) return;
      for (const index of segment.indexes) {
        const resolved = index < 0 ? value.length + index : index;
        if (resolved >= 0 && resolved < value.length) {
          out.push({ value: value[resolved] as unknown, parent: value, key: resolved });
        }
      }
      return;
    case "slice": {
      if (!Array.isArray(value)) return;
      const length = value.length;
      const clamp = (i: number): number => Math.min(Math.max(i < 0 ? length + i : i, 0), length);
      const start = clamp(segment.start ?? 0);
      const end = clamp(segment.end ?? length);
      for (let i = start; i < end; i++)
        out.push({ value: value[i] as unknown, parent: value, key: i });
      return;
    }
    case "filter":
      if (Array.isArray(value)) {
        value.forEach((element: unknown, i) => {
          if (passes(element, segment.source)) out.push({ value: element, parent: value, key: i });
        });
      } else if (isObject(value) && passes(value, segment.source)) {
        out.push(node);
      }
      return;
    case "scan":
      for (const descendant of descendantsOrSelf(node)) {
        if (segment.then.kind === "filter" && !isObject(descendant.value)) continue;
        apply(segment.then, descendant, out);
      }
      return;
  }
}

function passes(candidate: unknown, filter: string): boolean {
  try {
    return evaluateJsonPath([candidate], `$${filter}`).values.length > 0;
  } catch {
    return false;
  }
}

function children(value: unknown, out: Location[]): void {
  if (Array.isArray(value)) {
    value.forEach((element: unknown, i) => out.push({ value: element, parent: value, key: i }));
  } else if (isObject(value)) {
    for (const [key, element] of Object.entries(value)) {
      out.push({ value: element, parent: value, key });
    }
  }
}

function descendantsOrSelf(node: Location): Location[] {
  const result: Location[] = [];
  const visit = (location: Location): void => {
    if (!Array.isArray(location.value) && !isObject(location.value)) return;
    result.push(location);
    const kids: Location[] = [];
    children(location.value, kids);
    for (const kid of kids) visit(kid);
  };
  visit(node);
  return result;
}

/** Split a JSONPath into segments; undefined for syntax this helper does not handle. */
function parse(path: string): Segment[] | undefined {
  if (!path.startsWith("$")) return undefined;
  const segments: Segment[] = [];
  let i = 1;
  while (i < path.length) {
    let scan = false;
    if (path.startsWith("..", i)) {
      scan = true;
      i += 2;
    } else if (path.charAt(i) === ".") {
      i += 1;
    } else if (path.charAt(i) !== "[") {
      return undefined;
    }
    let segment: Segment | undefined;
    if (path.charAt(i) === "[") {
      const end = closingBracket(path, i);
      if (end === -1) return undefined;
      segment = bracket(path.slice(i + 1, end).trim(), path.slice(i, end + 1));
      i = end + 1;
    } else if (path.charAt(i) === "*") {
      segment = { kind: "wildcard" };
      i += 1;
    } else {
      let end = i;
      while (end < path.length && path.charAt(end) !== "." && path.charAt(end) !== "[") end++;
      const name = path.slice(i, end);
      if (name === "" || name.endsWith("()")) return undefined; // functions are not deletable
      segment = { kind: "members", names: [name] };
      i = end;
    }
    if (segment === undefined) return undefined;
    segments.push(scan ? { kind: "scan", then: segment } : segment);
  }
  return segments;
}

function bracket(inner: string, raw: string): Segment | undefined {
  if (inner.startsWith("?")) return { kind: "filter", source: raw };
  if (inner === "*") return { kind: "wildcard" };
  if (inner.startsWith("'") || inner.startsWith('"')) {
    const names: string[] = [];
    let i = 0;
    while (i < inner.length) {
      const quote = inner.charAt(i);
      if (quote !== "'" && quote !== '"') return undefined;
      let name = "";
      i += 1;
      while (i < inner.length && inner.charAt(i) !== quote) {
        if (inner.charAt(i) === "\\" && i + 1 < inner.length) i += 1;
        name += inner.charAt(i);
        i += 1;
      }
      if (i >= inner.length) return undefined;
      names.push(name);
      i += 1;
      while (inner.charAt(i) === " ") i += 1;
      if (i < inner.length) {
        if (inner.charAt(i) !== ",") return undefined;
        i += 1;
        while (inner.charAt(i) === " ") i += 1;
      }
    }
    return { kind: "members", names };
  }
  if (inner.includes(":")) {
    const [start, end] = inner.split(":").map((s) => s.trim());
    const toNumber = (s: string | undefined): number | undefined =>
      s === undefined || s === "" ? undefined : Number(s);
    const segment = { kind: "slice" as const, start: toNumber(start), end: toNumber(end) };
    if (Number.isNaN(segment.start) || Number.isNaN(segment.end)) return undefined;
    return segment;
  }
  const indexes = inner.split(",").map((s) => Number(s.trim()));
  if (indexes.some((n) => !Number.isInteger(n))) return undefined;
  return { kind: "indexes", indexes };
}

/** The index of the `]` closing the `[` at `start`, skipping quoted text and nested brackets. */
function closingBracket(path: string, start: number): number {
  let depth = 0;
  let quote: string | undefined;
  for (let i = start; i < path.length; i++) {
    const ch = path.charAt(i);
    if (quote !== undefined) {
      if (ch === "\\") i += 1;
      else if (ch === quote) quote = undefined;
      continue;
    }
    if (ch === "'" || ch === '"') quote = ch;
    else if (ch === "[" || ch === "(") depth += 1;
    else if (ch === "]" || ch === ")") {
      depth -= 1;
      if (depth === 0) return ch === "]" ? i : -1;
    }
  }
  return -1;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
