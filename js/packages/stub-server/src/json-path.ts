import { isDeepStrictEqual } from "node:util";
import { javaFullMatchRegex } from "./java-regex.js";

/**
 * A small JSONPath implementation that follows the Jayway JsonPath semantics WireMock
 * uses for `matchesJsonPath` and for the `jsonPath` response-template helper.
 *
 * Supported syntax:
 *   - root `$`, dot (`.name`) and bracket (`['name']`, `["name"]`, `.['name']`) members,
 *     multi-member `['a','b']`
 *   - wildcards `[*]` / `.*`, indexes `[0]` / `[-1]`, unions `[0,2]`, slices `[1:3]`
 *   - deep scan `..name`, `..*`, `..[?(…)]`
 *   - filters `[?(…)]` with `==`, `!=`, `<`, `<=`, `>`, `>=`, `=~ /regex/flags`, `in`, `nin`,
 *     `size`, `empty`, `contains`, `subsetof`, `anyof`, `noneof`, existence (`[?(@.field)]`),
 *     `!`, `&&`, `||` and parentheses; operands `@…` (current item), `$…` (document root) and
 *     JSON literals; `@.path.size()` / `@.path.length()` inside filters
 *   - a trailing `.size()` / `.length()` function
 *
 * Filter semantics follow Jayway: a filter applied to an array tests each element, a filter
 * applied to an object tests the object itself, and a filter applied to a scalar yields nothing.
 */

/** Thrown when an expression is not valid (or not supported) JSONPath. */
export class JsonPathSyntaxError extends Error {
  constructor(expression: string, position: number, reason: string) {
    super(`Invalid JSONPath "${expression}" at position ${position}: ${reason}`);
    this.name = "JsonPathSyntaxError";
  }
}

type Segment =
  | { readonly kind: "members"; readonly names: readonly string[] }
  | { readonly kind: "wildcard" }
  | { readonly kind: "indexes"; readonly indexes: readonly number[] }
  | {
      readonly kind: "slice";
      readonly start: number | undefined;
      readonly end: number | undefined;
    }
  | { readonly kind: "filter"; readonly predicate: Predicate }
  | { readonly kind: "scan"; readonly then: Segment };

type PathFunction = "size" | "length";

interface Path {
  readonly segments: readonly Segment[];
  readonly fn: PathFunction | undefined;
  readonly definite: boolean;
}

/** Regexes in each compiled expression that JavaScript cannot reproduce (they never match). */
const untranslatable = new WeakMap<Path, readonly string[]>();

type Operand =
  /** `@…` (relative to the filtered item) or `$…` (relative to the document root). */
  | { readonly kind: "path"; readonly path: Path; readonly fromRoot: boolean }
  | { readonly kind: "literal"; readonly value: unknown; readonly raw: string }
  | { readonly kind: "regex"; readonly regex: RegExp | null };

type ComparisonOperator =
  | "=="
  | "!="
  | "<"
  | "<="
  | ">"
  | ">="
  | "=~"
  | "in"
  | "nin"
  | "size"
  | "contains"
  | "empty"
  | "subsetof"
  | "anyof"
  | "noneof";

type Predicate =
  | { readonly kind: "and" | "or"; readonly left: Predicate; readonly right: Predicate }
  | { readonly kind: "not"; readonly operand: Predicate }
  | { readonly kind: "exists"; readonly operand: Extract<Operand, { kind: "path" }> }
  | {
      readonly kind: "compare";
      readonly op: ComparisonOperator;
      readonly left: Operand;
      readonly right: Operand;
    };

/** Result of evaluating a path: the matched values, plus whether the path is definite. */
export interface JsonPathResult {
  readonly definite: boolean;
  readonly values: readonly unknown[];
}

/** Expressions can come from the request (a template may read one), so bound the cache. */
const MAX_CACHED = 1000;
const cache = new Map<string, Path>();

/** Parse a JSONPath expression. Throws {@link JsonPathSyntaxError} if it is invalid. */
function compile(expression: string): Path {
  const cached = cache.get(expression);
  if (cached !== undefined) {
    return cached;
  }
  const parser = new Parser(expression);
  const path = parser.parseRootPath();
  if (parser.untranslatable.length > 0) untranslatable.set(path, parser.untranslatable);
  if (cache.size >= MAX_CACHED) cache.clear();
  cache.set(expression, path);
  return path;
}

/**
 * Evaluate `expression` against `root`. Throws {@link JsonPathSyntaxError} if the expression is
 * invalid.
 */
export function evaluateJsonPath(
  root: unknown,
  expression: string,
  options?: JsonPathOptions,
): JsonPathResult {
  const path = compile(expression);
  const leafToNull = options?.leafToNull === true;
  return { definite: path.definite, values: evaluatePath(path, root, root, leafToNull) };
}

/** Evaluation options. */
export interface JsonPathOptions {
  /**
   * Jayway's `DEFAULT_PATH_LEAF_TO_NULL`: an object missing the final member of the path yields
   * `null` instead of nothing. WireMock's `jsonPath` template helper uses it; `matchesJsonPath`
   * does not.
   */
  readonly leafToNull?: boolean;
}

/**
 * What in `expression` stub-server cannot evaluate faithfully (regexes JavaScript cannot
 * reproduce, such as Java's `/…/x`); empty when everything is supported. Throws
 * {@link JsonPathSyntaxError} if the expression is invalid.
 */
export function unsupportedJsonPathParts(expression: string): readonly string[] {
  return untranslatable.get(compile(expression)) ?? [];
}

/**
 * WireMock `matchesJsonPath` semantics: an invalid expression or a missing value never matches;
 * a definite path matches when its value is non-null and, for arrays and objects, non-empty; an
 * indefinite path (wildcard, filter, scan…) matches when it selects at least one value.
 */
export function matchesJsonPath(body: unknown, expression: string): boolean {
  if (body === undefined) {
    return false;
  }
  let result: JsonPathResult;
  try {
    result = evaluateJsonPath(body, expression);
  } catch {
    return false;
  }
  if (!result.definite) {
    return result.values.length > 0;
  }
  if (result.values.length === 0) {
    return false;
  }
  const value = result.values[0];
  if (value === null || value === undefined) {
    return false;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === "object") {
    return Object.keys(value).length > 0;
  }
  return true;
}

/**
 * Read a value the way Jayway's `JsonPath.read` does: a definite path yields the single value
 * (or `undefined` when missing), an indefinite path yields the list of matches.
 */
export function readJsonPath(
  root: unknown,
  expression: string,
  options?: JsonPathOptions,
): unknown {
  const result = evaluateJsonPath(root, expression, options);
  if (result.definite) {
    return result.values[0];
  }
  return [...result.values];
}

/** Where a value selected by a path lives: its container and the key or index in it. */
export interface JsonPathLocation {
  readonly parent: Record<string, unknown> | unknown[];
  readonly key: string | number;
}

/**
 * The locations of the values `expression` selects in `root` (for Jayway's `delete`), or
 * `undefined` when the path selects something without a container (the root, a filtered object
 * itself, a function result). Throws {@link JsonPathSyntaxError} if the expression is invalid.
 */
export function jsonPathLocations(
  root: unknown,
  expression: string,
): { readonly definite: boolean; readonly locations: readonly JsonPathLocation[] } | undefined {
  const path = compile(expression);
  const last = path.segments[path.segments.length - 1];
  if (last === undefined || path.fn !== undefined) return undefined;
  const parents = evaluatePath(
    { segments: path.segments.slice(0, -1), fn: undefined, definite: path.definite },
    root,
    root,
  );
  const locations: JsonPathLocation[] = [];
  for (const parent of parents) {
    if (!locateSegment(last, parent, root, locations)) return undefined;
  }
  return { definite: path.definite, locations };
}

function locateSegment(
  segment: Segment,
  node: unknown,
  root: unknown,
  out: JsonPathLocation[],
): boolean {
  switch (segment.kind) {
    case "members":
      if (isObject(node)) {
        for (const name of segment.names)
          if (Object.hasOwn(node, name)) out.push({ parent: node, key: name });
      }
      return true;
    case "wildcard":
      if (Array.isArray(node)) node.forEach((_, i) => out.push({ parent: node, key: i }));
      else if (isObject(node)) for (const key of Object.keys(node)) out.push({ parent: node, key });
      return true;
    case "indexes":
      if (Array.isArray(node)) {
        for (const index of segment.indexes) {
          const resolved = index < 0 ? node.length + index : index;
          if (resolved >= 0 && resolved < node.length) out.push({ parent: node, key: resolved });
        }
      }
      return true;
    case "slice":
      if (Array.isArray(node)) {
        const start = segment.start ?? 0;
        const end = segment.end ?? node.length;
        const from = start < 0 ? Math.max(0, node.length + start) : start;
        const to = end < 0 ? node.length + end : Math.min(end, node.length);
        for (let i = from; i < to; i++) out.push({ parent: node, key: i });
      }
      return true;
    case "filter":
      if (Array.isArray(node)) {
        node.forEach((element, i) => {
          if (testPredicate(segment.predicate, element, root)) out.push({ parent: node, key: i });
        });
        return true;
      }
      return !(isObject(node) && testPredicate(segment.predicate, node, root));
    case "scan":
      if (segment.then.kind === "filter") return false;
      for (const descendant of descendantsOrSelf(node)) {
        if (!locateSegment(segment.then, descendant, root, out)) return false;
      }
      return true;
  }
}

// ---------------------------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------------------------

function evaluatePath(path: Path, start: unknown, root: unknown, leafToNull = false): unknown[] {
  let nodes: unknown[] = [start];
  const last = path.segments.length - 1;
  for (const [i, segment] of path.segments.entries()) {
    const next: unknown[] = [];
    const nullForMissing = leafToNull && i === last && path.fn === undefined;
    for (const node of nodes) {
      applySegment(segment, node, root, next, nullForMissing);
    }
    nodes = next;
  }
  if (path.fn !== undefined) {
    const target = path.definite ? nodes[0] : nodes;
    const length = collectionSize(target);
    return length === undefined ? [] : [length];
  }
  return nodes;
}

function applySegment(
  segment: Segment,
  node: unknown,
  root: unknown,
  out: unknown[],
  nullForMissing = false,
): void {
  switch (segment.kind) {
    case "members": {
      if (!isObject(node)) return;
      if (segment.names.length === 1) {
        const name = segment.names[0] ?? "";
        if (Object.hasOwn(node, name)) out.push(node[name]);
        else if (nullForMissing) out.push(null);
        return;
      }
      // Jayway multi-member selection yields one object holding the requested members present.
      const picked: Record<string, unknown> = {};
      for (const name of segment.names) {
        if (Object.hasOwn(node, name)) picked[name] = node[name];
      }
      out.push(picked);
      return;
    }
    case "wildcard":
      if (Array.isArray(node)) out.push(...(node as unknown[]));
      else if (isObject(node)) out.push(...Object.values(node));
      return;
    case "indexes":
      if (!Array.isArray(node)) return;
      for (const index of segment.indexes) {
        const resolved = index < 0 ? node.length + index : index;
        if (resolved >= 0 && resolved < node.length) out.push(node[resolved]);
      }
      return;
    case "slice": {
      if (!Array.isArray(node)) return;
      out.push(...(node as unknown[]).slice(segment.start ?? 0, segment.end ?? node.length));
      return;
    }
    case "filter":
      if (Array.isArray(node)) {
        for (const element of node) {
          if (testPredicate(segment.predicate, element, root)) out.push(element);
        }
      } else if (isObject(node)) {
        if (testPredicate(segment.predicate, node, root)) out.push(node);
      }
      return;
    case "scan":
      for (const descendant of descendantsOrSelf(node)) {
        if (segment.then.kind === "filter") {
          if (isObject(descendant) && testPredicate(segment.then.predicate, descendant, root)) {
            out.push(descendant);
          }
        } else {
          applySegment(segment.then, descendant, root, out, nullForMissing);
        }
      }
      return;
  }
}

function descendantsOrSelf(node: unknown): unknown[] {
  const result: unknown[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      result.push(value);
      for (const element of value) visit(element);
    } else if (isObject(value)) {
      result.push(value);
      for (const element of Object.values(value)) visit(element);
    }
  };
  visit(node);
  return result;
}

/** A missing value inside a filter (Jayway's "undefined" node). */
const MISSING: unique symbol = Symbol("missing");

function testPredicate(predicate: Predicate, current: unknown, root: unknown): boolean {
  switch (predicate.kind) {
    case "and":
      return (
        testPredicate(predicate.left, current, root) &&
        testPredicate(predicate.right, current, root)
      );
    case "or":
      return (
        testPredicate(predicate.left, current, root) ||
        testPredicate(predicate.right, current, root)
      );
    case "not":
      return !testPredicate(predicate.operand, current, root);
    case "exists":
      return resolveOperand(predicate.operand, current, root) !== MISSING;
    case "compare":
      return compare(predicate, current, root);
  }
}

function resolveOperand(operand: Operand, current: unknown, root: unknown): unknown {
  if (operand.kind === "literal") return operand.value;
  if (operand.kind === "regex") return operand.regex;
  const values = evaluatePath(operand.path, operand.fromRoot ? root : current, root);
  if (operand.path.definite) {
    return values.length === 0 ? MISSING : values[0];
  }
  return values;
}

function compare(
  predicate: Extract<Predicate, { kind: "compare" }>,
  current: unknown,
  root: unknown,
): boolean {
  const left = resolveOperand(predicate.left, current, root);
  const right = resolveOperand(predicate.right, current, root);
  const rightRaw = predicate.right.kind === "literal" ? predicate.right.raw : undefined;

  switch (predicate.op) {
    case "==":
      return left !== MISSING && valuesEqual(left, right, rightRaw);
    case "!=":
      return left === MISSING || !valuesEqual(left, right, rightRaw);
    case "<":
    case "<=":
    case ">":
    case ">=": {
      // Jayway orders two numbers, or two strings (by UTF-16 code units, like Java).
      const comparable =
        (typeof left === "number" && typeof right === "number") ||
        (typeof left === "string" && typeof right === "string");
      if (!comparable) return false;
      if (predicate.op === "<") return left < right;
      if (predicate.op === "<=") return left <= right;
      if (predicate.op === ">") return left > right;
      return left >= right;
    }
    case "=~":
      return regexMatches(left, right);
    case "in":
      return (
        Array.isArray(right) &&
        left !== MISSING &&
        right.some((r) => valuesEqual(left, r, undefined))
      );
    case "nin":
      return (
        Array.isArray(right) &&
        left !== MISSING &&
        !right.some((r) => valuesEqual(left, r, undefined))
      );
    case "size": {
      const length = lengthOf(left);
      return length !== undefined && typeof right === "number" && length === right;
    }
    case "contains":
      if (typeof left === "string" && typeof right === "string") return left.includes(right);
      return Array.isArray(left) && left.some((l) => valuesEqual(l, right, rightRaw));
    case "empty": {
      const length = lengthOf(left);
      return length !== undefined && typeof right === "boolean" && (length === 0) === right;
    }
    case "subsetof":
      return (
        Array.isArray(left) &&
        Array.isArray(right) &&
        left.every((l) => right.some((r) => valuesEqual(l, r, undefined)))
      );
    case "anyof":
      return (
        Array.isArray(left) &&
        Array.isArray(right) &&
        left.some((l) => right.some((r) => valuesEqual(l, r, undefined)))
      );
    case "noneof":
      return (
        Array.isArray(left) &&
        Array.isArray(right) &&
        !left.some((l) => right.some((r) => valuesEqual(l, r, undefined)))
      );
  }
}

/**
 * Jayway equality: numbers compare numerically; a number compared with a numeric string
 * compares numerically when the JSON value is the number, and textually (against the literal as
 * written) when the JSON value is the string. Booleans never equal strings.
 */
function valuesEqual(left: unknown, right: unknown, rightRaw: string | undefined): boolean {
  if (typeof left === "number" && typeof right === "string") {
    return isNumeric(right) && left === Number(right);
  }
  if (typeof left === "string" && typeof right === "number") {
    return left === (rightRaw ?? String(right));
  }
  if (left === null || right === null) {
    return left === right;
  }
  if (typeof left === "object" || typeof right === "object") {
    return isDeepStrictEqual(left, right);
  }
  return left === right;
}

function isNumeric(value: string): boolean {
  return /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(value);
}

/** Jayway `=~`: whole-value match; strings, numbers and booleans by text, arrays by any element. */
function regexMatches(left: unknown, regex: unknown): boolean {
  if (!(regex instanceof RegExp)) return false;
  if (typeof left === "string" || typeof left === "number" || typeof left === "boolean") {
    return regex.test(String(left));
  }
  if (Array.isArray(left)) {
    return left.some((element) => regexMatches(element, regex));
  }
  return false;
}

/** Jayway's `size`/`length` operators also count string characters… */
function lengthOf(value: unknown): number | undefined {
  return typeof value === "string" ? value.length : collectionSize(value);
}

/** …but the `.size()`/`.length()` path functions only apply to arrays and objects. */
function collectionSize(value: unknown): number | undefined {
  if (Array.isArray(value)) return value.length;
  if (isObject(value)) return Object.keys(value).length;
  return undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// ---------------------------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------------------------

const COMPARISON_OPERATORS: readonly ComparisonOperator[] = [
  "==",
  "!=",
  "<=",
  ">=",
  "=~",
  "<",
  ">",
];
const WORD_OPERATORS: readonly ComparisonOperator[] = [
  "nin",
  "in",
  "size",
  "contains",
  "empty",
  "subsetof",
  "anyof",
  "noneof",
];

class Parser {
  private pos = 0;
  /** Regexes in the expression JavaScript cannot reproduce. */
  readonly untranslatable: string[] = [];

  constructor(private readonly source: string) {}

  parseRootPath(): Path {
    this.skipWhitespace();
    this.expect("$");
    const path = this.parseSegments();
    this.skipWhitespace();
    if (this.pos < this.source.length) {
      this.fail(`unexpected "${this.source.charAt(this.pos)}"`);
    }
    return path;
  }

  /** Segments following `$` or `@`. Stops at the first character that cannot continue a path. */
  private parseSegments(): Path {
    const segments: Segment[] = [];
    let definite = true;
    let fn: PathFunction | undefined;

    for (;;) {
      const ch = this.peek();
      if (ch === "." && this.peek(1) === ".") {
        this.pos += 2;
        const then = this.peek() === "[" ? this.parseBracket() : this.parseDotMember();
        segments.push({ kind: "scan", then });
        definite = false;
      } else if (ch === ".") {
        this.pos += 1;
        if (this.peek() === "[") {
          segments.push(this.parseBracket());
        } else {
          const functionName = this.tryParseFunction();
          if (functionName !== undefined) {
            fn = functionName;
            break;
          }
          segments.push(this.parseDotMember());
        }
      } else if (ch === "[") {
        segments.push(this.parseBracket());
      } else {
        break;
      }
      const last = segments[segments.length - 1];
      if (last !== undefined && !isDefiniteSegment(last)) definite = false;
    }
    return { segments, fn, definite };
  }

  private tryParseFunction(): PathFunction | undefined {
    for (const name of ["size", "length"] as const) {
      if (this.source.startsWith(`${name}()`, this.pos)) {
        this.pos += name.length + 2;
        return name;
      }
    }
    return undefined;
  }

  private parseDotMember(): Segment {
    if (this.peek() === "*") {
      this.pos += 1;
      return { kind: "wildcard" };
    }
    const start = this.pos;
    while (
      this.pos < this.source.length &&
      !/[.[\]()\s=!<>&|,]/.test(this.source.charAt(this.pos))
    ) {
      this.pos += 1;
    }
    if (this.pos === start) {
      this.fail("expected a member name");
    }
    return { kind: "members", names: [this.source.slice(start, this.pos)] };
  }

  private parseBracket(): Segment {
    this.expect("[");
    this.skipWhitespace();
    let segment: Segment;
    const ch = this.peek();
    if (ch === "?") {
      this.pos += 1;
      this.skipWhitespace();
      this.expect("(");
      const predicate = this.parseOr();
      this.skipWhitespace();
      this.expect(")");
      segment = { kind: "filter", predicate };
    } else if (ch === "*") {
      this.pos += 1;
      segment = { kind: "wildcard" };
    } else if (ch === "'" || ch === '"') {
      const names = [this.parseString()];
      this.skipWhitespace();
      while (this.peek() === ",") {
        this.pos += 1;
        this.skipWhitespace();
        names.push(this.parseString());
        this.skipWhitespace();
      }
      segment = { kind: "members", names };
    } else {
      segment = this.parseIndexOrSlice();
    }
    this.skipWhitespace();
    this.expect("]");
    return segment;
  }

  private parseIndexOrSlice(): Segment {
    const first = this.tryParseInteger();
    this.skipWhitespace();
    if (this.peek() === ":") {
      this.pos += 1;
      this.skipWhitespace();
      const end = this.tryParseInteger();
      return { kind: "slice", start: first, end };
    }
    if (first === undefined) {
      this.fail("expected an index, '*', a quoted name or a filter");
    }
    const indexes = [first];
    while (this.peek() === ",") {
      this.pos += 1;
      this.skipWhitespace();
      const next = this.tryParseInteger();
      if (next === undefined) this.fail("expected an index");
      indexes.push(next);
      this.skipWhitespace();
    }
    return { kind: "indexes", indexes };
  }

  private tryParseInteger(): number | undefined {
    const match = /^-?\d+/.exec(this.source.slice(this.pos));
    if (match === null) return undefined;
    this.pos += match[0].length;
    return Number(match[0]);
  }

  // --- filter expressions ---

  private parseOr(): Predicate {
    let left = this.parseAnd();
    for (;;) {
      this.skipWhitespace();
      if (!this.source.startsWith("||", this.pos)) return left;
      this.pos += 2;
      left = { kind: "or", left, right: this.parseAnd() };
    }
  }

  private parseAnd(): Predicate {
    let left = this.parseUnary();
    for (;;) {
      this.skipWhitespace();
      if (!this.source.startsWith("&&", this.pos)) return left;
      this.pos += 2;
      left = { kind: "and", left, right: this.parseUnary() };
    }
  }

  private parseUnary(): Predicate {
    this.skipWhitespace();
    if (this.peek() === "!" && this.peek(1) !== "=") {
      this.pos += 1;
      return { kind: "not", operand: this.parseUnary() };
    }
    if (this.peek() === "(") {
      this.pos += 1;
      const inner = this.parseOr();
      this.skipWhitespace();
      this.expect(")");
      return inner;
    }
    return this.parseComparison();
  }

  private parseComparison(): Predicate {
    const left = this.parseOperand();
    this.skipWhitespace();
    const op = this.tryParseOperator();
    if (op === undefined) {
      if (left.kind !== "path") this.fail("expected a comparison operator");
      return { kind: "exists", operand: left };
    }
    this.skipWhitespace();
    const right = op === "=~" ? this.parseRegex() : this.parseOperand();
    return { kind: "compare", op, left, right };
  }

  private tryParseOperator(): ComparisonOperator | undefined {
    for (const op of COMPARISON_OPERATORS) {
      if (this.source.startsWith(op, this.pos)) {
        this.pos += op.length;
        return op;
      }
    }
    for (const op of WORD_OPERATORS) {
      if (
        this.source.startsWith(op, this.pos) &&
        /[\s[('"\d-]/.test(this.source.charAt(this.pos + op.length))
      ) {
        this.pos += op.length;
        return op;
      }
    }
    return undefined;
  }

  private parseOperand(): Operand {
    this.skipWhitespace();
    const ch = this.peek();
    if (ch === "@" || ch === "$") {
      this.pos += 1;
      return { kind: "path", path: this.parseSegments(), fromRoot: ch === "$" };
    }
    const start = this.pos;
    const value = this.parseLiteral();
    return { kind: "literal", value, raw: this.source.slice(start, this.pos) };
  }

  private parseLiteral(): unknown {
    this.skipWhitespace();
    const ch = this.peek();
    if (ch === "'" || ch === '"') {
      return this.parseString();
    }
    if (ch === "[") {
      this.pos += 1;
      const items: unknown[] = [];
      this.skipWhitespace();
      if (this.peek() !== "]") {
        for (;;) {
          items.push(this.parseLiteral());
          this.skipWhitespace();
          if (this.peek() !== ",") break;
          this.pos += 1;
        }
      }
      this.skipWhitespace();
      this.expect("]");
      return items;
    }
    if (ch === "{") {
      this.pos += 1;
      const object: Record<string, unknown> = {};
      this.skipWhitespace();
      if (this.peek() !== "}") {
        for (;;) {
          this.skipWhitespace();
          const key = this.parseString();
          this.skipWhitespace();
          this.expect(":");
          object[key] = this.parseLiteral();
          this.skipWhitespace();
          if (this.peek() !== ",") break;
          this.pos += 1;
        }
      }
      this.skipWhitespace();
      this.expect("}");
      return object;
    }
    const match = /^(true|false|null|-?\d+(\.\d+)?([eE][+-]?\d+)?)/.exec(
      this.source.slice(this.pos),
    );
    if (match === null) {
      this.fail("expected a literal");
    }
    this.pos += match[0].length;
    if (match[0] === "true") return true;
    if (match[0] === "false") return false;
    if (match[0] === "null") return null;
    return Number(match[0]);
  }

  private parseString(): string {
    const quote = this.peek();
    if (quote !== "'" && quote !== '"') this.fail("expected a quoted string");
    this.pos += 1;
    let result = "";
    while (this.pos < this.source.length) {
      const ch = this.source.charAt(this.pos);
      if (ch === "\\" && this.pos + 1 < this.source.length) {
        result += this.source.charAt(this.pos + 1);
        this.pos += 2;
      } else if (ch === quote) {
        this.pos += 1;
        return result;
      } else {
        result += ch;
        this.pos += 1;
      }
    }
    this.fail("unterminated string");
  }

  /** `/pattern/flags` — Jayway matches the whole value (Java `Matcher.matches()`). */
  private parseRegex(): Operand {
    this.expect("/");
    let pattern = "";
    for (;;) {
      if (this.pos >= this.source.length) this.fail("unterminated regex");
      const ch = this.source.charAt(this.pos);
      if (ch === "\\" && this.pos + 1 < this.source.length) {
        pattern += ch + this.source.charAt(this.pos + 1);
        this.pos += 2;
      } else if (ch === "/") {
        this.pos += 1;
        break;
      } else {
        pattern += ch;
        this.pos += 1;
      }
    }
    const flagsMatch = /^[a-z]*/.exec(this.source.slice(this.pos));
    const javaFlags = flagsMatch?.[0] ?? "";
    this.pos += javaFlags.length;

    // Jayway compiles the regex with Java's Pattern (no DOTALL); a Java-only construct JavaScript
    // cannot reproduce yields null, and the filter never matches.
    const regex = javaFullMatchRegex(pattern, { dotAll: false, javaFlags });
    if (regex === null) this.untranslatable.push(`/${pattern}/${javaFlags}`);
    return { kind: "regex", regex };
  }

  // --- low-level helpers ---

  private peek(offset = 0): string {
    return this.source.charAt(this.pos + offset);
  }

  private skipWhitespace(): void {
    while (/\s/.test(this.peek()) && this.pos < this.source.length) this.pos += 1;
  }

  private expect(token: string): void {
    if (!this.source.startsWith(token, this.pos)) {
      this.fail(`expected "${token}"`);
    }
    this.pos += token.length;
  }

  private fail(reason: string): never {
    throw new JsonPathSyntaxError(this.source, this.pos, reason);
  }
}

function isDefiniteSegment(segment: Segment): boolean {
  if (segment.kind === "members") return true;
  if (segment.kind === "indexes") return segment.indexes.length === 1;
  return false;
}
