import { JavaPattern, objectsHash, tryJacksonRead } from "./java-values.js";

/**
 * The pieces of the JVM contract DSL (`sh.stubborn.contract.spec.internal`) a YAML contract is
 * turned into before it becomes a WireMock mapping, and the value transformations of the JVM's
 * `MapConverter` / `ContentUtils` that work on them.
 */

/** `ExecutionProperty`: a command run on the producer side (the stub side keeps the value). */
export class ExecutionProperty {
  constructor(readonly command: string) {}
  toString(): string {
    return this.command;
  }
  javaHashCode(): number {
    return objectsHash(this.command);
  }
}

/** `DslProperty`: a value with a client (stub) side and a server (test) side. */
export class DslProperty {
  constructor(
    readonly client: unknown,
    readonly server: unknown = client,
  ) {}
  javaHashCode(): number {
    return objectsHash(patternText(this.client), patternText(this.server));
  }
}

/** `MatchingStrategy.Type`. */
export type MatchingStrategyType =
  | "EQUAL_TO"
  | "CONTAINS"
  | "MATCHING"
  | "NOT_MATCHING"
  | "EQUAL_TO_JSON"
  | "EQUAL_TO_XML"
  | "ABSENT"
  | "BINARY_EQUAL_TO";

/** `MatchingStrategy`: how the stub compares a value. */
export class MatchingStrategy {
  constructor(
    readonly value: unknown,
    readonly type: MatchingStrategyType,
  ) {}
}

/** `FromFileProperty` read as bytes (`bodyFromFileAsBytes`). */
export class FromFileProperty {
  constructor(
    readonly bytes: Uint8Array,
    readonly fileName: string,
  ) {}
  isJson(): boolean {
    return this.fileName.endsWith(".json");
  }
  isXml(): boolean {
    return this.fileName.endsWith(".xml");
  }
  asString(): string {
    return Buffer.from(this.bytes).toString("utf-8");
  }
  toString(): string {
    return this.asString();
  }
}

/** `NamedProperty`: a multipart file part. */
export class NamedProperty {
  constructor(
    readonly name: DslProperty,
    readonly value: DslProperty,
    readonly contentType: DslProperty,
  ) {}
}

/** `DslProperty.equals` compares a `Pattern` by its text. */
export function patternText(value: unknown): unknown {
  return value instanceof JavaPattern ? value.pattern : value;
}

type ParsingFunction = (text: string) => unknown;

/** `MapConverter.JSON_PARSING_FUNCTION`. */
export const JSON_PARSING: ParsingFunction = (text) => {
  const parsed = tryJacksonRead(text);
  if (parsed === undefined) throw new Error(`The current json [${text}] could not be deserialized`);
  return parsed.value;
};

/** `MapConverter.IDENTITY`. */
export const IDENTITY: ParsingFunction = (text) => text;

/**
 * `MapConverter.transformValues`: applies `fn` to every leaf; a string holding a JSON object or
 * array is parsed and transformed as that structure. An exception in `fn` leaves the value as is.
 */
export function transformValues(
  value: unknown,
  fn: (value: unknown) => unknown,
  parsing: ParsingFunction = JSON_PARSING,
): unknown {
  if (typeof value === "string") {
    try {
      const parsed = parsing(value);
      if (parsed instanceof Map) return convertMap(parsed as Map<unknown, unknown>, fn, parsing);
      if (Array.isArray(parsed)) return transformValues(parsed, fn, parsing);
    } catch {
      // not JSON
    }
    return extract(value, fn);
  }
  if (value instanceof Map) return convertMap(value as Map<unknown, unknown>, fn, parsing);
  if (Array.isArray(value)) return value.map((v) => transformValues(v, fn, parsing));
  return extract(value, (val) => {
    const next = fn(val);
    if (
      next instanceof Map ||
      Array.isArray(next) ||
      (typeof next === "string" && val !== null && val !== undefined)
    ) {
      return transformValues(next, fn, parsing);
    }
    return next;
  });
}

function extract(value: unknown, fn: (value: unknown) => unknown): unknown {
  try {
    return fn(value);
  } catch {
    return value;
  }
}

function convertMap(
  map: Map<unknown, unknown>,
  fn: (value: unknown) => unknown,
  parsing: ParsingFunction,
): Map<unknown, unknown> {
  const out = new Map<unknown, unknown>();
  for (const [k, v] of map) out.set(k, transformValues(v, fn, parsing));
  return out;
}

/** `MapConverter.getClientOrServerSideValues`. */
export function sideValues(
  value: unknown,
  clientSide: boolean,
  parsing: ParsingFunction = JSON_PARSING,
): unknown {
  const fn = (val: unknown): unknown => {
    if (val instanceof DslProperty) {
      const side = clientSide ? val.client : val.server;
      return side !== null && side !== undefined ? sideValues(side, clientSide, parsing) : null;
    }
    if (val instanceof MatchingStrategy) {
      return val.value !== null && val.value !== undefined
        ? sideValues(val.value, clientSide, parsing)
        : null;
    }
    if (val instanceof FromFileProperty) return val.bytes;
    return val;
  };
  return transformValues(value, fn, parsing);
}

/** `MapConverter.getStubSideValues`. */
export function stubSideValues(value: unknown, parsing: ParsingFunction = JSON_PARSING): unknown {
  return sideValues(value, true, parsing);
}

/** `MapConverter.transformToClientValues`. */
export function toClientValues(value: unknown): unknown {
  return transformValues(value, (v) =>
    v instanceof DslProperty ? v.client : v instanceof MatchingStrategy ? v.value : v,
  );
}

const TEMPORARY_PATTERN = /^.*REGEXP>>(.*)<<.*$/;
const TEMPORARY_EXECUTION = /^["]?EXECUTION>>(.*)<<["]?$/;
const TEMPORARY_OPTIONAL = /^OPTIONAL>>(.*)<<$/;

/** `ContentUtils.returnParsedObject`: the JVM's placeholders for regexes in JSON text. */
export function returnParsedObject(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = javaTrim(value);
  let m = TEMPORARY_PATTERN.exec(trimmed);
  if (m !== null) return new JavaPattern(m[1] ?? "");
  m = TEMPORARY_EXECUTION.exec(trimmed);
  if (m !== null) return new ExecutionProperty(m[1] ?? "");
  m = TEMPORARY_OPTIONAL.exec(trimmed);
  if (m !== null) return new JavaPattern(`(${m[1] ?? ""})?`);
  return value;
}

/** `String.trim()`: strips characters up to U+0020. */
export function javaTrim(text: string): string {
  let start = 0;
  let end = text.length;
  while (start < end && text.charCodeAt(start) <= 0x20) start++;
  while (end > start && text.charCodeAt(end - 1) <= 0x20) end--;
  return text.slice(start, end);
}
