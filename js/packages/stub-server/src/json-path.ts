import { isDeepStrictEqual } from "node:util";

/**
 * A small JSONPath engine covering the expressions the contract generator writes into
 * WireMock mappings, evaluated with the semantics WireMock (Jayway JsonPath) applies:
 *
 *   - `$.name`, `$.['name']`, `$['name']`, `$[0]`, `$[*]`, `$.*` at any depth
 *   - filters `[?(...)]` on arrays (applied to each element) and on objects (applied to
 *     the object itself), with `==`, `!=`, `<`, `<=`, `>`, `>=`, `=~ /regex/flags`,
 *     existence (`@.name`), `.size()` / `.length()` on arrays, `&&`, `||` and parentheses
 *
 * Anything else (deep scan `..`, unions, slices, script expressions) is rejected with a
 * {@link JsonPathSyntaxError} rather than guessed at.
 */

/** Thrown when an expression is not valid in the supported JSONPath subset. */
export class JsonPathSyntaxError extends Error {
  constructor(expression: string, reason: string) {
    super(`Unsupported JSONPath "${expression}": ${reason}`);
    this.name = "JsonPathSyntaxError";
  }
}

/** Thrown when a definite path does not exist in the document. */
export class JsonPathNotFoundError extends Error {
  constructor(expression: string) {
    super(`No results for path "${expression}"`);
    this.name = "JsonPathNotFoundError";
  }
}

type Segment =
  | { readonly kind: "property"; readonly name: string }
  | { readonly kind: "index"; readonly index: number }
  | { readonly kind: "wildcard" }
  | { readonly kind: "filter"; readonly predicate: Predicate };

type Operand =
  | {
      readonly kind: "path";
      readonly segments: readonly Segment[];
      readonly fn: "size" | undefined;
    }
  | { readonly kind: "literal"; readonly value: unknown }
  | { readonly kind: "regex"; readonly regex: RegExp };

type ComparisonOperator = "==" | "!=" | "<" | "<=" | ">" | ">=" | "=~";

type Predicate =
  | { readonly kind: "and" | "or"; readonly left: Predicate; readonly right: Predicate }
  | { readonly kind: "exists"; readonly operand: Operand }
  | {
      readonly kind: "compare";
      readonly op: ComparisonOperator;
      readonly left: Operand;
      readonly right: Operand;
    };

/** Result of evaluating a path: a single value for a definite path, a list otherwise. */
export type JsonPathResult =
  | { readonly definite: true; readonly value: unknown }
  | { readonly definite: false; readonly values: readonly unknown[] };

/** Evaluation options. */
export interface JsonPathOptions {
  /**
   * When the last segment names a property an object does not have, yield `null` instead of
   * failing (definite path) or skipping (indefinite path). WireMock's `jsonPath` template
   * helper evaluates with this option; request matching does not.
   */
  readonly missingLeafAsNull?: boolean;
}

const MISSING = Symbol("missing");

/** Parse and evaluate `expression` against `document`. */
export function evaluateJsonPath(
  document: unknown,
  expression: string,
  options: JsonPathOptions = {},
): JsonPathResult {
  const segments = new Parser(expression).parseRootPath();
  const values = walk(document, segments, options.missingLeafAsNull === true, () => {
    throw new JsonPathNotFoundError(expression);
  });
  return isDefinite(segments) ? { definite: true, value: values[0] } : { definite: false, values };
}

/**
 * WireMock `matchesJsonPath` semantics: the request matches when the path yields a result —
 * a non-empty list for an indefinite path, or a value that is not null, not an empty array
 * and not an empty object for a definite one. Missing paths and unsupported expressions do
 * not match.
 */
export function matchesJsonPath(document: unknown, expression: string): boolean {
  let result: JsonPathResult;
  try {
    result = evaluateJsonPath(document, expression);
  } catch (err: unknown) {
    if (err instanceof JsonPathNotFoundError || err instanceof JsonPathSyntaxError) {
      return false;
    }
    throw err;
  }
  if (!result.definite) {
    return result.values.length > 0;
  }
  const value = result.value;
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (isObject(value)) return Object.keys(value).length > 0;
  return true;
}

function isDefinite(segments: readonly Segment[]): boolean {
  return segments.every((s) => s.kind === "property" || s.kind === "index");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function walk(
  root: unknown,
  segments: readonly Segment[],
  missingLeafAsNull: boolean,
  onDefiniteMiss: () => never,
): unknown[] {
  let current: unknown[] = [root];
  let definiteSoFar = true;

  segments.forEach((segment, i) => {
    const isLeaf = i === segments.length - 1;
    const next: unknown[] = [];
    for (const node of current) {
      switch (segment.kind) {
        case "property":
          if (isObject(node) && Object.hasOwn(node, segment.name)) {
            next.push(node[segment.name]);
          } else if (isLeaf && missingLeafAsNull && isObject(node)) {
            next.push(null);
          } else if (definiteSoFar) {
            onDefiniteMiss();
          }
          break;
        case "index": {
          const index =
            segment.index < 0 && Array.isArray(node) ? node.length + segment.index : segment.index;
          if (Array.isArray(node) && index >= 0 && index < node.length) {
            next.push(node[index]);
          } else if (definiteSoFar) {
            onDefiniteMiss();
          }
          break;
        }
        case "wildcard":
          if (Array.isArray(node)) next.push(...(node as unknown[]));
          else if (isObject(node)) next.push(...Object.values(node));
          break;
        case "filter":
          if (Array.isArray(node)) {
            for (const element of node as unknown[]) {
              if (test(segment.predicate, element)) next.push(element);
            }
          } else if (isObject(node) && test(segment.predicate, node)) {
            next.push(node);
          }
          break;
      }
    }
    if (segment.kind === "wildcard" || segment.kind === "filter") definiteSoFar = false;
    current = next;
  });

  return current;
}

function test(predicate: Predicate, node: unknown): boolean {
  switch (predicate.kind) {
    case "and":
      return test(predicate.left, node) && test(predicate.right, node);
    case "or":
      return test(predicate.left, node) || test(predicate.right, node);
    case "exists":
      return resolve(predicate.operand, node) !== MISSING;
    case "compare":
      return compare(predicate.op, resolve(predicate.left, node), predicate.right, node);
  }
}

function resolve(operand: Operand, node: unknown): unknown {
  switch (operand.kind) {
    case "literal":
      return operand.value;
    case "regex":
      return operand.regex;
    case "path": {
      let values: unknown[];
      try {
        values = walk(node, operand.segments, false, () => {
          throw new JsonPathNotFoundError("@");
        });
      } catch (err: unknown) {
        if (err instanceof JsonPathNotFoundError) return MISSING;
        throw err;
      }
      const value = isDefinite(operand.segments) ? values[0] : values;
      if (operand.fn === "size") {
        return Array.isArray(value) ? value.length : MISSING;
      }
      return value;
    }
  }
}

function compare(
  op: ComparisonOperator,
  left: unknown,
  rightOperand: Operand,
  node: unknown,
): boolean {
  if (op === "=~") {
    if (rightOperand.kind !== "regex") return false;
    if (typeof left !== "string" && typeof left !== "number") return false;
    return rightOperand.regex.test(String(left));
  }
  const right = resolve(rightOperand, node);
  if (op === "!=") {
    return left === MISSING || right === MISSING || !jsonEquals(left, right);
  }
  if (left === MISSING || right === MISSING) return false;
  if (op === "==") return jsonEquals(left, right);
  const order = ordering(left, right);
  if (order === undefined) return false;
  switch (op) {
    case "<":
      return order < 0;
    case "<=":
      return order <= 0;
    case ">":
      return order > 0;
    case ">=":
      return order >= 0;
  }
}

/** Jayway compares a number and a numeric string by value. */
function jsonEquals(left: unknown, right: unknown): boolean {
  if (typeof left === "number" && typeof right === "string") return numericString(right) === left;
  if (typeof left === "string" && typeof right === "number") return numericString(left) === right;
  return isDeepStrictEqual(left, right);
}

function ordering(left: unknown, right: unknown): number | undefined {
  const l = typeof left === "string" && typeof right === "number" ? numericString(left) : left;
  const r = typeof right === "string" && typeof left === "number" ? numericString(right) : right;
  if (typeof l === "number" && typeof r === "number") return l - r;
  if (typeof l === "string" && typeof r === "string") return l < r ? -1 : l > r ? 1 : 0;
  return undefined;
}

function numericString(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

// --- Parser ---

class Parser {
  private pos = 0;

  constructor(private readonly src: string) {}

  parseRootPath(): Segment[] {
    this.skipSpaces();
    if (!this.eat("$")) this.fail("must start with $");
    const segments = this.parseSegments();
    this.skipSpaces();
    if (this.pos !== this.src.length) this.fail(`unexpected "${this.src.slice(this.pos)}"`);
    return segments;
  }

  private parseSegments(): Segment[] {
    const segments: Segment[] = [];
    for (;;) {
      if (this.src.startsWith("..", this.pos)) this.fail("deep scan (..) is not supported");
      if (this.peek() === "." && this.src[this.pos + 1] === "[") {
        this.pos++;
        continue;
      }
      if (this.eat(".")) {
        if (this.eat("*")) {
          segments.push({ kind: "wildcard" });
          continue;
        }
        const name = this.readName();
        segments.push({ kind: "property", name });
        continue;
      }
      if (this.peek() === "[") {
        segments.push(this.parseBracket());
        continue;
      }
      return segments;
    }
  }

  private parseBracket(): Segment {
    this.expect("[");
    this.skipSpaces();
    let segment: Segment;
    const c = this.peek();
    if (c === "'" || c === '"') {
      segment = { kind: "property", name: this.readQuoted() };
    } else if (c === "*") {
      this.pos++;
      segment = { kind: "wildcard" };
    } else if (c === "?") {
      this.pos++;
      this.skipSpaces();
      this.expect("(");
      const predicate = this.parseOr();
      this.skipSpaces();
      this.expect(")");
      segment = { kind: "filter", predicate };
    } else {
      const match = /^-?\d+/.exec(this.src.slice(this.pos));
      if (match === null) this.fail(`unsupported bracket expression at ${String(this.pos)}`);
      this.pos += match[0].length;
      segment = { kind: "index", index: Number(match[0]) };
    }
    this.skipSpaces();
    this.expect("]");
    return segment;
  }

  private parseOr(): Predicate {
    let left = this.parseAnd();
    for (;;) {
      this.skipSpaces();
      if (!this.eat("||")) return left;
      left = { kind: "or", left, right: this.parseAnd() };
    }
  }

  private parseAnd(): Predicate {
    let left = this.parseAtom();
    for (;;) {
      this.skipSpaces();
      if (!this.eat("&&")) return left;
      left = { kind: "and", left, right: this.parseAtom() };
    }
  }

  private parseAtom(): Predicate {
    this.skipSpaces();
    if (this.eat("(")) {
      const inner = this.parseOr();
      this.skipSpaces();
      this.expect(")");
      return inner;
    }
    const left = this.parseOperand();
    this.skipSpaces();
    const op = this.readOperator();
    if (op === undefined) {
      if (left.kind !== "path") this.fail("a filter needs a comparison or an @ path");
      return { kind: "exists", operand: left };
    }
    this.skipSpaces();
    const right = this.parseOperand();
    if (op === "=~" && right.kind !== "regex") this.fail("=~ needs a /regex/ on the right");
    return { kind: "compare", op, left, right };
  }

  private readOperator(): ComparisonOperator | undefined {
    for (const op of ["==", "!=", "<=", ">=", "=~", "<", ">"] as const) {
      if (this.eat(op)) return op;
    }
    return undefined;
  }

  private parseOperand(): Operand {
    this.skipSpaces();
    const c = this.peek();
    if (c === "@") {
      this.pos++;
      const segments = this.parseSegments();
      let fn: "size" | undefined;
      const last = segments[segments.length - 1];
      if (
        last?.kind === "property" &&
        (last.name === "size" || last.name === "length") &&
        this.eat("()")
      ) {
        segments.pop();
        fn = "size";
      }
      return { kind: "path", segments, fn };
    }
    if (c === "'" || c === '"') return { kind: "literal", value: this.readQuoted() };
    if (c === "/") return { kind: "regex", regex: this.readRegex() };
    const rest = this.src.slice(this.pos);
    const keyword = /^(true|false|null)\b/.exec(rest);
    if (keyword !== null) {
      this.pos += keyword[0].length;
      return { kind: "literal", value: JSON.parse(keyword[0]) as unknown };
    }
    const number = /^-?\d+(\.\d+)?([eE][+-]?\d+)?/.exec(rest);
    if (number !== null) {
      this.pos += number[0].length;
      return { kind: "literal", value: Number(number[0]) };
    }
    return this.fail(`unexpected "${rest}"`);
  }

  private readName(): string {
    const match = /^[^.[\]\s()=!<>&|'"]+/.exec(this.src.slice(this.pos));
    if (match === null) this.fail(`expected a property name at ${String(this.pos)}`);
    this.pos += match[0].length;
    return match[0];
  }

  private readQuoted(): string {
    const quote = this.src[this.pos];
    this.pos++;
    let out = "";
    while (this.pos < this.src.length) {
      const c = this.src[this.pos] ?? "";
      if (c === "\\" && this.pos + 1 < this.src.length) {
        out += this.src[this.pos + 1] ?? "";
        this.pos += 2;
        continue;
      }
      this.pos++;
      if (c === quote) return out;
      out += c;
    }
    return this.fail("unterminated string");
  }

  /** Reads `/pattern/flags`; the pattern must match the whole value, as in Java. */
  private readRegex(): RegExp {
    this.pos++;
    let pattern = "";
    let inClass = false;
    while (this.pos < this.src.length) {
      const c = this.src[this.pos] ?? "";
      if (c === "\\") {
        pattern += c + (this.src[this.pos + 1] ?? "");
        this.pos += 2;
        continue;
      }
      if (c === "[") inClass = true;
      else if (c === "]") inClass = false;
      else if (c === "/" && !inClass) break;
      pattern += c;
      this.pos++;
    }
    if (!this.eat("/")) this.fail("unterminated regex");
    const flags = /^[a-z]*/.exec(this.src.slice(this.pos))?.[0] ?? "";
    this.pos += flags.length;
    if (/[^ims]/.test(flags)) this.fail(`unsupported regex flags "${flags}"`);
    try {
      // eslint-disable-next-line security/detect-non-literal-regexp -- pattern comes from the stub mapping, not from the request
      return new RegExp(`^(?:${pattern})$`, flags);
    } catch (err: unknown) {
      return this.fail(`invalid regex: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private skipSpaces(): void {
    while (this.src[this.pos] === " ") this.pos++;
  }

  private peek(): string | undefined {
    return this.src[this.pos];
  }

  private eat(token: string): boolean {
    if (this.src.startsWith(token, this.pos)) {
      this.pos += token.length;
      return true;
    }
    return false;
  }

  private expect(token: string): void {
    if (!this.eat(token)) this.fail(`expected "${token}" at ${String(this.pos)}`);
  }

  private fail(reason: string): never {
    throw new JsonPathSyntaxError(this.src, reason);
  }
}
