import { deletePath, readPath } from "./jayway-document.js";

/**
 * Field-by-field verification of a JSON response body, as the JVM-generated contract test does
 * it (stubborn-contract-verifier: `JsonToJsonPathsConverter`, `JsonPathTraverser`; jsonassert:
 * `JsonAsserter`).
 *
 * The generated test does not compare the body as a whole: every leaf of the contract body
 * becomes one assertion, e.g. `assertThatJson(parsedJson).field("['id']").isEqualTo(1)`, which
 * checks that the JSONPath `$[?(@.['id'] == 1)]` selects something. Fields the response has but
 * the contract does not are therefore accepted. Arrays are matched without regard to order (the
 * default; `assertJsonSize` is off): `array("['items']").contains("['id']").isEqualTo(1)` checks
 * `$.['items'][*][?(@.['id'] == 1)]`, i.e. that some element has that id. Each leaf is checked on
 * its own, so two fields of one contract element may be satisfied by different response elements.
 */

/** One step from a node to its children: a member, or every element (`[*]`). */
type Step = { readonly kind: "member"; readonly name: string } | { readonly kind: "each" };

/** One generated assertion. */
export type JsonAssertion =
  /** `…[?(@.['name'] == value)]` */
  | {
      readonly kind: "field";
      readonly steps: readonly Step[];
      readonly name: string;
      readonly value: Scalar;
    }
  /** `…[?(@ == value)]`: an element of a list of primitives. */
  | { readonly kind: "element"; readonly steps: readonly Step[]; readonly value: Scalar }
  /** `….isEmpty()`: an empty object or list in the contract. */
  | { readonly kind: "empty"; readonly steps: readonly Step[] };

type Scalar = string | number | boolean | null;

/** A failed assertion, described with the JSONPath the JVM test checks. */
export interface JsonAssertionFailure {
  readonly path: string;
  readonly expected: string;
  readonly actual: string;
}

/**
 * `JsonPathMatcherUtils.removeMatchingJsonPaths`: a copy of `body` without the entries the body
 * matchers cover (they are verified by the matchers instead), and without the containers that
 * leaves empty.
 */
export function removeMatchingJsonPaths(body: unknown, paths: readonly string[]): unknown {
  const copy = structuredClone(body);
  if (paths.length === 0) return copy;
  const deleted: string[] = [];
  for (const path of paths) {
    const entry = readPath(copy, path);
    if (entry !== null && deletePath(copy, path)) deleted.push(path);
  }
  deleted.sort().reverse();
  for (const path of deleted) removeTrailingContainers(path, copy, 0);
  return copy;
}

const MAX_CLEANUP_DEPTH = 64;

/** `JsonPathMatcherUtils.removeTrailingContainers`, kept string-based like the original. */
function removeTrailingContainers(matcherPath: string, root: unknown, depth: number): void {
  if (depth > MAX_CLEANUP_DEPTH) return;
  const brackets = [...matcherPath.matchAll(/\[(.*?)\]/g)];
  const last = brackets.at(-1)?.[0];
  const withoutArray =
    last !== undefined ? matcherPath.substring(0, matcherPath.lastIndexOf(last)) : matcherPath;
  const object = readPath(root, withoutArray);
  if (
    object !== null &&
    isContainer(object) &&
    containsOnlyEmptyElements(object) &&
    matcherPath !== "$[*]"
  ) {
    const toDelete = withoutArray === "$" ? "$[*]" : withoutArray;
    if (toDelete.includes("..")) {
      const whole = readPath(root, "$");
      if (Array.isArray(whole) && whole.every((item) => containsOnlyEmptyElements(item))) {
        deletePath(root, "$[*]");
      }
      return;
    }
    if (deletePath(root, toDelete)) removeTrailingContainers(toDelete, root, depth + 1);
    return;
  }
  const lastDot = matcherPath.lastIndexOf(".");
  if (lastDot === -1) return;
  const parent = matcherPath.substring(0, lastDot);
  const parentObject = readPath(root, parent);
  if (
    parentObject !== null &&
    isContainer(parentObject) &&
    containsOnlyEmptyElements(parentObject) &&
    parent !== "$"
  ) {
    if (deletePath(root, parent)) removeTrailingContainers(parent, root, depth + 1);
  }
}

/** `JsonPathMatcherUtils.containsOnlyEmptyElements`. */
function containsOnlyEmptyElements(value: unknown): boolean {
  const items = Array.isArray(value) ? value : isObject(value) ? Object.values(value) : undefined;
  if (items === undefined) return false;
  return items.every(
    (item) =>
      (Array.isArray(item) && item.length === 0) ||
      (isObject(item) && Object.keys(item).length === 0),
  );
}

/** `JsonBodyVerificationBuilder.mapOrListBodyReducedToEmpty`. */
export function reducedToEmpty(original: unknown, reduced: unknown): boolean {
  return size(original) > 0 && size(reduced) === 0;
}

function size(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (isObject(value)) return Object.keys(value).length;
  return -1;
}

/**
 * The assertions the JVM generates for a JSON body (`JsonToJsonPathsConverter.transform` with
 * `assertJsonSize` off). `includeEmptyCheck` is false when matchers removed every entry.
 */
export function buildJsonAssertions(body: unknown, includeEmptyCheck: boolean): JsonAssertion[] {
  const out: JsonAssertion[] = [];
  if (!Array.isArray(body) && !isObject(body)) return out;
  if (size(body) === 0) {
    if (includeEmptyCheck) out.push({ kind: "empty", steps: [] });
    return out;
  }
  if (Array.isArray(body)) visitArray(body, [], out);
  else visitObject(body, [], out);
  return out;
}

function visitObject(
  object: Record<string, unknown>,
  steps: readonly Step[],
  out: JsonAssertion[],
): void {
  if (Object.keys(object).length === 0) {
    out.push({ kind: "empty", steps });
    return;
  }
  for (const [name, value] of Object.entries(object)) {
    const here: Step[] = [...steps, { kind: "member", name }];
    if (Array.isArray(value)) {
      if (value.length === 0) out.push({ kind: "empty", steps: [...here, { kind: "each" }] });
      else visitArray(value, here, out);
    } else if (isObject(value)) {
      visitObject(value, here, out);
    } else {
      out.push({ kind: "field", steps, name, value: value as Scalar });
    }
  }
}

/**
 * A non-empty list at `steps`. A list of primitives is filtered directly (`…[?(@ == v)]`); in a
 * list holding objects or lists, objects and lists are descended into through `[*]` and bare
 * primitives are still filtered on the list itself (`JsonPathTraverser.processComplexList`).
 */
function visitArray(list: readonly unknown[], steps: readonly Step[], out: JsonAssertion[]): void {
  const each: Step[] = [...steps, { kind: "each" }];
  for (const element of list) {
    if (Array.isArray(element)) {
      // An empty nested list emits no assertion on the JVM (the traverser stops without one).
      if (element.length > 0) visitArray(element, each, out);
    } else if (isObject(element)) {
      visitObject(element, each, out);
    } else {
      out.push({ kind: "element", steps, value: element as Scalar });
    }
  }
}

/** Run one assertion against the parsed response body; undefined when it holds. */
export function checkJsonAssertion(
  actual: unknown,
  assertion: JsonAssertion,
): JsonAssertionFailure | undefined {
  const { nodes, missing } = walk(actual, assertion.steps);
  const base = describeSteps(assertion.steps);

  if (assertion.kind === "empty") {
    // JsonAsserter.isEmpty reads the path: a definite path that is missing throws.
    const definite = assertion.steps.every((s) => s.kind === "member");
    const read = definite ? nodes[0] : nodes;
    if (!missing && !(definite && nodes.length === 0) && isObjectEmpty(read)) return undefined;
    return {
      path: base,
      expected: "empty",
      actual: missing || (definite && nodes.length === 0) ? "(missing)" : stringify(read),
    };
  }

  const matched: unknown[] = [];
  const candidates: unknown[] = [];
  for (const node of nodes) {
    const tested = Array.isArray(node) ? (node as unknown[]) : isObject(node) ? [node] : [];
    for (const item of tested) {
      if (assertion.kind === "field") {
        if (isObject(item) && Object.hasOwn(item, assertion.name)) {
          candidates.push(item[assertion.name]);
          if (jaywayEquals(item[assertion.name], assertion.value)) matched.push(item);
        }
      } else {
        candidates.push(item);
        if (jaywayEquals(item, assertion.value)) matched.push(item);
      }
    }
  }
  // JsonAsserter.check: the selection must hold something other than empty values (or null).
  if (matched.length > 0 && !containsEmptyElementsOnly(matched)) return undefined;

  const path =
    assertion.kind === "field" ? `${base}${describeMember(assertion.name)}` : `${base}[*]`;
  const single = assertion.steps.every((s) => s.kind === "member") && assertion.kind === "field";
  return {
    path,
    expected:
      assertion.kind === "field"
        ? stringify(assertion.value)
        : `an element ${stringify(assertion.value)}`,
    actual:
      candidates.length === 0
        ? "(missing)"
        : single && candidates.length === 1
          ? stringify(candidates[0])
          : stringify(candidates),
  };
}

/** Follow the steps; `missing` when a member is absent while the path is still definite. */
function walk(root: unknown, steps: readonly Step[]): { nodes: unknown[]; missing: boolean } {
  let nodes: unknown[] = [root];
  let definite = true;
  for (const step of steps) {
    const next: unknown[] = [];
    if (step.kind === "each") {
      definite = false;
      for (const node of nodes) {
        if (Array.isArray(node)) next.push(...(node as unknown[]));
        else if (isObject(node)) next.push(...Object.values(node));
      }
    } else {
      for (const node of nodes) {
        if (isObject(node) && Object.hasOwn(node, step.name)) next.push(node[step.name]);
        else if (definite) return { nodes: [], missing: true };
      }
    }
    nodes = next;
  }
  return { nodes, missing: false };
}

/** JsonAsserter.isObjectEmpty */
function isObjectEmpty(value: unknown): boolean {
  if (Array.isArray(value)) return containsEmptyElementsOnly(value);
  if (isObject(value)) return Object.keys(value).length === 0;
  return value === null || value === undefined;
}

/** JsonAsserter.containsEmptyElementsOnly */
function containsEmptyElementsOnly(values: readonly unknown[]): boolean {
  return values.every((value) => isObjectEmpty(value));
}

/**
 * Jayway's `==` between a JSON value (left) and a literal written by the JVM test (right):
 * numbers compare numerically, a number against a string literal compares numerically, a
 * string against a number literal compares with the literal's text, booleans never equal
 * strings. Mirrors stub-server's JSONPath evaluator.
 */
function jaywayEquals(left: unknown, right: Scalar): boolean {
  if (typeof left === "number" && typeof right === "string") {
    return /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(right) && left === Number(right);
  }
  if (typeof left === "string" && typeof right === "number") return left === javaNumberText(right);
  if (left === null || right === null) return left === right;
  return left === right;
}

/** `new BigDecimal(number.toString()).toPlainString()`, as JsonAsserter writes number literals. */
export function javaNumberText(value: number): string {
  if (Number.isInteger(value) && Math.abs(value) >= 1e21) return BigInt(value).toString();
  return String(value);
}

function describeSteps(steps: readonly Step[]): string {
  return `$${steps.map((s) => (s.kind === "each" ? "[*]" : describeMember(s.name))).join("")}`;
}

function describeMember(name: string): string {
  return `.['${name.replace(/'/g, "\\'")}']`;
}

function stringify(value: unknown): string {
  return JSON.stringify(value) ?? "undefined";
}

function isContainer(value: unknown): boolean {
  return Array.isArray(value) || isObject(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
