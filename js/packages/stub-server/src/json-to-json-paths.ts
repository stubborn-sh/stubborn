import {
  ExecutionProperty,
  returnParsedObject,
  sideValues,
  transformValues,
  JSON_PARSING,
} from "./contract-dsl.js";
import {
  bigDecimalPlain,
  escapeJava,
  isJavaNumber,
  JavaDouble,
  JavaInt,
  JavaPattern,
  type JavaNumber,
} from "./java-values.js";

/**
 * A port of the JVM's `JsonToJsonPathsConverter` (stub side, no array size checks): turns a JSON
 * request body into the JSONPath expressions WireMock's `matchesJsonPath` checks, one per leaf.
 * It is built, like the JVM's, from two layers that are ported as they are, mutable buffers
 * included, because the generated paths depend on their quirks:
 *
 *  - {@link Asserter}: `stubborn-contract-jsonassert`'s `JsonAsserter` family, which builds the
 *    path (`$`, `.['field']`, `[*]`, `[?(@.['field'] == 'value')]`);
 *  - {@link Verifiable}: the verifier's `DelegatingJsonVerifiable`, which records the calls made
 *    (the JVM dedupes paths by that record and inspects its last entry).
 */

type AsserterKind = "field" | "array" | "arrayValue" | "nameless" | "ready";

/** `JsonAsserter` and its subclasses (checks disabled, as `withoutThrowingException` does). */
class Asserter {
  readonly buffer: string[];
  constructor(
    readonly kind: AsserterKind,
    buffer: readonly string[],
    readonly fieldName: unknown,
  ) {
    this.buffer = [...buffer];
  }

  jsonPath(): string {
    return this.buffer.join("");
  }

  isIteratingOverNamelessArray(): boolean {
    return this.kind === "nameless";
  }
  isIteratingOverArray(): boolean {
    return this.kind === "array";
  }
  isAssertingAValueInArray(): boolean {
    return this.kind === "arrayValue";
  }

  contains(value: unknown): Asserter {
    if (this.kind === "arrayValue") {
      return new Asserter("arrayValue", this.buffer, value).isEqualToObject(value);
    }
    const asserter = new Asserter("field", this.buffer, value);
    asserter.buffer.push("[*]");
    return asserter;
  }

  field(value: unknown): Asserter {
    const asserter = new Asserter("field", this.buffer, value);
    asserter.buffer.push(`.${String(value)}`);
    return asserter;
  }

  array(value?: unknown): Asserter {
    if (value === undefined || value === null) {
      const asserter = new Asserter("array", this.buffer, null);
      asserter.buffer.push("[*]");
      return asserter;
    }
    const asserter = new Asserter("array", this.buffer, value);
    asserter.buffer.push(`.${String(value)}[*]`);
    return asserter;
  }

  arrayField(): Asserter {
    const last = this.buffer[this.buffer.length - 1] ?? "";
    // Issue #9 (mutates this asserter's buffer, as the JVM does).
    if ((last !== "[*]" && last.endsWith("[*]")) || this.jsonPath().endsWith("[*][*]")) {
      this.buffer.pop();
      this.buffer.push(last.replaceAll("[*]", ""));
    }
    return new Asserter("arrayValue", this.buffer, null);
  }

  private ready(): Asserter {
    return new Asserter("ready", this.buffer, this.fieldName);
  }

  private finish(ready: Asserter): Asserter {
    this.buffer.length = 0;
    this.buffer.push(...ready.buffer);
    return ready;
  }

  isEqualToString(value: string): Asserter {
    const ready = this.ready();
    if (this.kind === "arrayValue") {
      ready.buffer.push(`[?(@ == ${quote(value)})]`);
      return ready;
    }
    ready.buffer.pop();
    ready.buffer.push(`[?(@.${String(this.fieldName)} == ${quote(value)})]`);
    return this.finish(ready);
  }

  isEqualToNumber(value: JavaNumber): Asserter {
    const ready = this.ready();
    if (this.kind === "arrayValue") {
      ready.buffer.push(`[?(@ == ${bigDecimalPlain(value.toString())})]`);
      return ready;
    }
    ready.buffer.pop();
    ready.buffer.push(`[?(@.${String(this.fieldName)} == ${bigDecimalPlain(value.toString())})]`);
    return this.finish(ready);
  }

  isEqualToBoolean(value: boolean): Asserter {
    const ready = this.ready();
    if (this.kind === "arrayValue") {
      ready.buffer.push(`[?(@ == ${String(value)})]`);
      return ready;
    }
    ready.buffer.pop();
    ready.buffer.push(`[?(@.${String(this.fieldName)} == ${String(value)})]`);
    return this.finish(ready);
  }

  /** `isEqualTo(Object)`: dispatches on the runtime type. */
  isEqualToObject(value: unknown): Asserter {
    if (value === null || value === undefined) return this.isNull();
    if (isJavaNumber(value)) return this.isEqualToNumber(value);
    if (typeof value === "boolean") return this.isEqualToBoolean(value);
    if (value instanceof JavaPattern) return this.matches(value.pattern);
    return this.isEqualToString(String(value));
  }

  isNull(): Asserter {
    const ready = this.ready();
    ready.buffer.pop();
    ready.buffer.push(`[?(@.${String(this.fieldName)} == null)]`);
    return this.finish(ready);
  }

  matches(value: string): Asserter {
    const ready = this.ready();
    const regex = value.replaceAll("'", "\\'").replaceAll("/", "\\/");
    if (this.kind === "arrayValue") {
      ready.buffer.push(`[?(@ =~ /${regex}/)]`);
      return ready;
    }
    ready.buffer.pop();
    ready.buffer.push(`[?(@.${String(this.fieldName)} =~ /${regex}/)]`);
    return this.finish(ready);
  }

  isEmpty(): Asserter {
    return this;
  }
}

function quote(value: string): string {
  return `'${value.replaceAll("'", "\\'")}'`;
}

/** `ShouldTraverse`: a field name that must be traversed with `field`, never `contains`. */
class ShouldTraverse {
  constructor(readonly value: unknown) {}
  toString(): string {
    return String(this.value);
  }
}

/** `DelegatingJsonVerifiable` (and `FinishedDelegatingJsonVerifiable` when `finished`). */
class Verifiable {
  readonly methods: string[];
  constructor(
    readonly delegate: Asserter,
    methods: readonly string[],
    readonly finished = false,
    private readonly keyBefore = "",
  ) {
    this.methods = [...methods];
  }

  private static finishedWith(
    keyBefore: string,
    delegate: Asserter,
    methods: readonly string[],
  ): Verifiable {
    return new Verifiable(delegate, methods, true, keyBefore);
  }

  jsonPath(): string {
    const path = this.delegate.jsonPath();
    return this.finished && path.includes("@.null") ? this.keyBefore : path;
  }

  /** Identity in the JVM's `LinkedHashSet` of paths. */
  key(): string {
    return `[${this.methods.join(", ")}]`;
  }

  isIteratingOverNamelessArray(): boolean {
    return this.delegate.isIteratingOverNamelessArray();
  }
  isIteratingOverArray(): boolean {
    return this.delegate.isIteratingOverArray();
  }
  isAssertingAValueInArray(): boolean {
    return this.delegate.isAssertingAValueInArray();
  }

  assertsSize(): boolean {
    return this.methods.some((m) => m.includes(".hasSize(") || m.includes(".isEmpty()"));
  }

  private appendQuoted(name: string, value: unknown): void {
    this.methods.push(`.${name}(${wrapValueWithQuotes(value)})`);
  }

  contains(value: unknown): Verifiable {
    const v = Verifiable.finishedWith(this.delegate.jsonPath(), this.delegate.contains(value), this.methods);
    v.appendQuoted("contains", value);
    if (this.isAssertingAValueInArray()) v.methods.push(".value()");
    return v;
  }

  field(value: unknown): Verifiable {
    const put = value instanceof ShouldTraverse ? value.value : value;
    const wrapped = wrapInBrackets(put);
    const v = new Verifiable(this.delegate.field(wrapped), this.methods);
    if (this.delegate.isIteratingOverArray() && !(value instanceof ShouldTraverse)) {
      v.appendQuoted("contains", wrapped);
    } else {
      v.appendQuoted("field", wrapped);
    }
    return v;
  }

  array(value?: unknown): Verifiable {
    if (value === undefined) {
      const v = new Verifiable(this.delegate.array(), this.methods);
      v.methods.push(".array()");
      return v;
    }
    const wrapped = wrapInBrackets(value);
    const v = new Verifiable(this.delegate.array(wrapped), this.methods);
    v.appendQuoted("array", wrapped);
    return v;
  }

  arrayField(value?: unknown): Verifiable {
    if (value === undefined) {
      const v = new Verifiable(this.delegate.arrayField(), this.methods);
      v.methods.push(".arrayField()");
      return v;
    }
    const wrapped = wrapInBrackets(value);
    const v = new Verifiable(this.delegate.field(wrapped).arrayField(), this.methods);
    v.appendQuoted("array", wrapped);
    return v;
  }

  iterationPassingArray(): Verifiable {
    return new Verifiable(this.delegate, this.methods);
  }

  isEqualToString(value: string): Verifiable {
    const ready = Verifiable.finishedWith(
      this.delegate.jsonPath(),
      this.delegate.isEqualToString(value),
      this.methods,
    );
    const last = ready.methods[ready.methods.length - 1] ?? "";
    if (this.delegate.isAssertingAValueInArray() && last === ".arrayField()") {
      ready.appendQuoted("isEqualTo", escapedHackedJavaText(value));
      ready.methods.push(".value()");
    } else if (this.delegate.isAssertingAValueInArray() && !last.includes("array")) {
      ready.methods.push(".value()");
    } else {
      ready.appendQuoted("isEqualTo", escapedHackedJavaText(value));
    }
    return ready;
  }

  isEqualToObject(value: unknown): Verifiable {
    if (value === null || value === undefined) return this.isNull();
    return this.isEqualToString(String(value));
  }

  isEqualToNumber(value: JavaNumber): Verifiable {
    const ready = Verifiable.finishedWith(
      this.delegate.jsonPath(),
      this.delegate.isEqualToNumber(value),
      this.methods,
    );
    const last = ready.methods[ready.methods.length - 1] ?? "";
    const containsAMatcher =
      last.includes("isEqualTo") || last.includes("matches") || last.includes("isNull");
    if (this.delegate.isAssertingAValueInArray() && containsAMatcher) {
      ready.methods.push(".value()");
    } else {
      const text =
        value instanceof JavaInt && value.type === "Long" ? `${value.toString()}L` : value.toString();
      ready.methods.push(`.isEqualTo(${text})`);
    }
    return ready;
  }

  isEqualToBoolean(value: boolean): Verifiable {
    const ready = Verifiable.finishedWith(
      this.delegate.jsonPath(),
      this.delegate.isEqualToBoolean(value),
      this.methods,
    );
    if (this.delegate.isAssertingAValueInArray()) ready.methods.push(".value()");
    else ready.methods.push(`.isEqualTo(${String(value)})`);
    return ready;
  }

  isNull(): Verifiable {
    const ready = Verifiable.finishedWith(this.delegate.jsonPath(), this.delegate.isNull(), this.methods);
    ready.methods.push(".isNull()");
    return ready;
  }

  isEmpty(): Verifiable {
    const ready = Verifiable.finishedWith(this.delegate.jsonPath(), this.delegate.isEmpty(), this.methods);
    ready.methods.push(".isEmpty()");
    return ready;
  }

  matches(value: string): Verifiable {
    const ready = Verifiable.finishedWith(
      this.delegate.jsonPath(),
      this.delegate.matches(value),
      this.methods,
    );
    ready.appendQuoted("matches", escapedHackedJavaText(value));
    if (this.delegate.isAssertingAValueInArray()) ready.methods.push(".value()");
    return ready;
  }
}

function wrapValueWithQuotes(value: unknown): string {
  if (value === null || value === undefined) return "null";
  return typeof value === "string" ? `"${value.replaceAll('"', '\\"')}"` : String(value);
}

function escapedHackedJavaText(value: string): string {
  return escapeJava(value).replaceAll('\\"', '"');
}

function wrapInBrackets(name: unknown): unknown {
  return isJavaNumber(name) ? name : `['${String(name)}']`;
}

function isPrimitive(value: unknown): boolean {
  return typeof value === "string" || typeof value === "boolean" || isJavaNumber(value);
}

function onlyPrimitives(list: readonly unknown[]): boolean {
  return list.length > 0 && list.every((e) => e !== null && e !== undefined && isPrimitive(e));
}

/** `JsonPathTraverser` without ordered array verification. */
class Traverser {
  constructor(private readonly collect: (v: Verifiable) => void) {}

  traverse(json: unknown, root: Verifiable): void {
    if (this.isScalarRoot(json)) return;
    this.processValue(root, json);
  }

  private isScalarRoot(json: unknown): boolean {
    const value = returnParsedObject(json);
    if (value instanceof Map || Array.isArray(value)) return false;
    if (typeof value === "string" && value !== "") {
      try {
        return !(JSON_PARSING(value) instanceof Map);
      } catch {
        return true;
      }
    }
    return true;
  }

  private processValue(key: Verifiable, raw: unknown): unknown {
    const value = returnParsedObject(raw);
    if (typeof value === "string" && value !== "") return this.processString(key, value);
    if (value instanceof Map) return this.processMap(key, value as Map<unknown, unknown>);
    if (Array.isArray(value)) return this.processList(key, value);
    if (key.isIteratingOverArray()) {
      const parsed = returnParsedObject(value);
      this.processValue(key.arrayField().contains(parsed), parsed);
    }
    return this.emit(key, value);
  }

  private processString(key: Verifiable, value: string): unknown {
    try {
      const parsed = JSON_PARSING(value);
      if (parsed instanceof Map) return this.processMap(key, parsed as Map<unknown, unknown>);
    } catch {
      // not JSON
    }
    return this.emit(key, value);
  }

  private processMap(key: Verifiable, map: Map<unknown, unknown>): unknown {
    if (map.size === 0) return this.emit(key.isEmpty(), map);
    for (const [entryKey, entryValue] of map) {
      const value = returnParsedObject(entryValue);
      this.processValue(this.keyVerifiable(key, entryKey, value), value);
    }
    return map;
  }

  private processList(key: Verifiable, list: unknown[]): unknown {
    if (list.length === 0) return this.emit(key, list);
    if (onlyPrimitives(list)) {
      const arrayKey = key.arrayField();
      for (const item of list) {
        const element = returnParsedObject(item);
        this.processValue(valueToAsserter(arrayKey, element), element);
      }
      return list;
    }
    const arrayKey = this.arrayAsserter(key, list);
    for (const element of list) {
      const parsed = returnParsedObject(element);
      if (parsed !== null && parsed !== undefined && !(parsed instanceof Map) && !Array.isArray(parsed)) {
        this.processValue(valueToAsserter(key.arrayField(), parsed), parsed);
      } else {
        this.processValue(listElementAsserter(arrayKey, parsed), parsed);
      }
    }
    return list;
  }

  private keyVerifiable(parent: Verifiable, entryKey: unknown, value: unknown): Verifiable {
    if (Array.isArray(value)) {
      if (value.length === 0) return parent.array(entryKey).isEmpty();
      if (onlyPrimitives(value)) return parent.arrayField(entryKey);
      return parent.array(entryKey);
    }
    if (value instanceof Map) return parent.field(new ShouldTraverse(entryKey));
    return valueToAsserter(parent.field(entryKey), value);
  }

  private arrayAsserter(key: Verifiable, list: unknown[]): Verifiable {
    if (key.isIteratingOverNamelessArray()) return key.array();
    if (key.isIteratingOverArray() && list.every((item) => Array.isArray(item))) {
      const allPrimitive = list.every((item) => onlyPrimitives(item as unknown[]));
      return allPrimitive ? key.iterationPassingArray() : key.array();
    }
    if (key.isIteratingOverArray()) return key.iterationPassingArray();
    return key;
  }

  private emit(key: Verifiable, value: unknown): unknown {
    const collection = value instanceof Map || Array.isArray(value);
    if (key.isAssertingAValueInArray() && !collection) this.collect(valueToAsserter(key, value));
    else if (collection || key.finished) this.collect(key);
    else this.collect(valueToAsserter(key, value));
    return value;
  }
}

function listElementAsserter(verifiable: Verifiable, element: unknown): Verifiable {
  if (verifiable.isAssertingAValueInArray()) {
    const parsed = returnParsedObject(element);
    if (parsed instanceof Map || Array.isArray(parsed)) return verifiable;
    if (parsed instanceof JavaPattern) return verifiable.matches(parsed.pattern);
    return verifiable.contains(parsed);
  }
  if (Array.isArray(element) && onlyPrimitives(element)) return verifiable.array();
  return verifiable;
}

function valueToAsserter(key: Verifiable, raw: unknown): Verifiable {
  const value = returnParsedObject(raw);
  if (key.finished) return key;
  if (value instanceof JavaPattern) return key.matches(value.pattern);
  if (value instanceof ExecutionProperty) return key;
  if (value instanceof JavaInt || value instanceof JavaDouble) return key.isEqualToNumber(value);
  if (typeof value === "boolean") return key.isEqualToBoolean(value);
  return key.isEqualToObject(value);
}

function isEmptyJson(json: unknown): boolean {
  if (json === null || json === undefined) return true;
  if (typeof json === "string") return json === "";
  if (json instanceof Map) return json.size === 0;
  if (Array.isArray(json)) return json.length === 0;
  return false;
}

/** A generated path: the JSONPath, and whether it only checks a size (WireMock skips those). */
export interface GeneratedJsonPath {
  readonly jsonPath: string;
  readonly assertsSize: boolean;
}

/**
 * `JsonToJsonPathsConverter.transformToJsonPathWithStubsSideValuesAndNoArraySizeCheck`: the
 * paths, in the JVM's order and deduplicated as it does.
 */
export function stubSideJsonPaths(json: unknown): GeneratedJsonPath[] {
  if (isEmptyJson(json)) return [];
  const converted = sideValues(json, true);
  // ContentUtils.convertDslPropsToTemporaryRegexPatterns: plain values pass through (strings
  // holding JSON are parsed once more).
  const withPatterns = transformValues(converted, (v) => (v instanceof JavaPattern ? `REGEXP>>${v.pattern}<<` : v));
  const root = new Verifiable(new Asserter("nameless", ["$"], ""), []);
  const seen = new Map<string, Verifiable>();
  new Traverser((v) => {
    const key = v.key();
    if (!seen.has(key)) seen.set(key, v);
  }).traverse(withPatterns, root);
  return [...seen.values()].map((v) => ({ jsonPath: v.jsonPath(), assertsSize: v.assertsSize() }));
}
