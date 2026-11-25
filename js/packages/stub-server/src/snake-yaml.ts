import yaml from "js-yaml";
import { JavaDouble, JavaInt } from "./java-values.js";

/**
 * Loads YAML documents the way the JVM reads a contract: SnakeYAML's `new Yaml().loadAll(…)`
 * (YAML 1.1 implicit types: `yes`/`no`/`on`/`off` booleans, `0x`/`0b`/octal/sexagesimal and
 * `_`-separated integers, `1e3` floats, timestamps), then Jackson's `convertValue`, which turns a
 * timestamp into its ISO-8601 text (`2017-01-01T00:00:00.000Z`) and every map key into a string.
 *
 * Numbers come back as {@link JavaInt} / {@link JavaDouble}, mappings as `Map`s, sequences as
 * arrays. Known difference: a mapping whose keys look like array indexes ("1", "2") is read
 * through a JavaScript object, which iterates those keys first.
 */
export function loadYamlDocuments(text: string): unknown[] {
  // js-yaml ends a block scalar that runs to the end of the input with a line break even when
  // the input has none; SnakeYAML (clip chomping) does not add one.
  const last = text.charAt(text.length - 1);
  const atEnd = last !== "" && !"\n\r\"'".includes(last);
  return yaml
    .loadAll(text, undefined, {
      schema: SNAKE_SCHEMA,
      json: true,
      ...(atEnd
        ? {
            listener(this: yaml.State, event: yaml.EventType, state: yaml.State) {
              const s = state as unknown as { result: unknown; position: number; length: number };
              if (
                event === "close" &&
                typeof s.result === "string" &&
                s.position >= s.length &&
                s.result.endsWith("\n")
              ) {
                s.result = s.result.slice(0, -1);
              }
            },
          }
        : {}),
    })
    .map(toJava);
}

const BOOL = /^(?:yes|Yes|YES|no|No|NO|true|True|TRUE|false|False|FALSE|on|On|ON|off|Off|OFF)$/;
const INT =
  /^(?:[-+]?0b[0-1_]+|[-+]?0[0-7_]+|[-+]?(?:0|[1-9][0-9_]*)|[-+]?0x[0-9a-fA-F_]+|[-+]?[1-9][0-9_]*(?::[0-5]?[0-9])+)$/;
const FLOAT =
  /^(?:[-+]?(?:\.[0-9]+|[0-9][0-9_]*(?:\.[0-9_]*)?)(?:[eE][-+]?[0-9]+)?|[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*|[-+]?\.(?:inf|Inf|INF)|\.(?:nan|NaN|NAN))$/;
const NULL = /^(?:~|null|Null|NULL|)$/;
const TIMESTAMP =
  /^(?:([0-9]{4})-([0-9]{2})-([0-9]{2})|([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:[Tt]|[ \t]+)([0-9]{1,2}):([0-9]{2}):([0-9]{2})(?:\.([0-9]*))?(?:[ \t]*(Z|([-+])([0-9]{1,2})(?::([0-9]{2}))?))?)$/;

/** A SnakeYAML timestamp, already as the text Jackson writes for a `java.util.Date`. */
class YamlTimestamp {
  constructor(readonly iso: string) {}
  toString(): string {
    return this.iso;
  }
}

function sexagesimal(text: string): number {
  return text.split(":").reduce((total, part) => total * 60 + Number(part), 0);
}

const nullType = new yaml.Type("tag:yaml.org,2002:null", {
  kind: "scalar",
  resolve: (data: string | null) => data === null || NULL.test(data),
  construct: () => null,
  predicate: (o) => o === null,
  represent: () => "null",
});

const boolType = new yaml.Type("tag:yaml.org,2002:bool", {
  kind: "scalar",
  resolve: (data: string | null) => data !== null && BOOL.test(data),
  construct: (data: string) => /^(?:yes|true|on)$/i.test(data),
});

const intType = new yaml.Type("tag:yaml.org,2002:int", {
  kind: "scalar",
  resolve: (data: string | null) => data !== null && INT.test(data),
  construct: (data: string) => {
    let text = data.replaceAll("_", "");
    let sign = 1n;
    if (text.startsWith("-")) {
      sign = -1n;
      text = text.slice(1);
    } else if (text.startsWith("+")) text = text.slice(1);
    let value: bigint;
    if (text === "0") value = 0n;
    else if (text.startsWith("0b")) value = BigInt(`0b${text.slice(2)}`);
    else if (text.startsWith("0x")) value = BigInt(`0x${text.slice(2)}`);
    else if (text.startsWith("0")) value = BigInt(`0o${text.slice(1)}`);
    else if (text.includes(":")) value = BigInt(sexagesimal(text));
    else value = BigInt(text);
    return JavaInt.of(sign * value);
  },
});

const floatType = new yaml.Type("tag:yaml.org,2002:float", {
  kind: "scalar",
  resolve: (data: string | null) => data !== null && FLOAT.test(data),
  construct: (data: string) => {
    const text = data.replaceAll("_", "").toLowerCase();
    if (text.endsWith(".nan")) return new JavaDouble(NaN);
    if (text.endsWith(".inf")) return new JavaDouble(text.startsWith("-") ? -Infinity : Infinity);
    if (text.includes(":")) {
      const negative = text.startsWith("-");
      return new JavaDouble((negative ? -1 : 1) * sexagesimal(text.replace(/^[-+]/, "")));
    }
    return new JavaDouble(Number(text));
  },
});

const timestampType = new yaml.Type("tag:yaml.org,2002:timestamp", {
  kind: "scalar",
  resolve: (data: string | null) => data !== null && TIMESTAMP.test(data),
  construct: (data: string) => {
    const m = TIMESTAMP.exec(data) as RegExpExecArray;
    let millis: number;
    if (m[1] !== undefined) {
      millis = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    } else {
      const fraction = (m[10] ?? "").padEnd(3, "0").slice(0, 3);
      millis = Date.UTC(
        Number(m[4]),
        Number(m[5]) - 1,
        Number(m[6]),
        Number(m[7]),
        Number(m[8]),
        Number(m[9]),
        Number(fraction),
      );
      if (m[12] !== undefined) {
        const offset = (Number(m[13]) * 60 + Number(m[14] ?? "0")) * 60_000;
        millis -= m[12] === "-" ? -offset : offset;
      }
    }
    return new YamlTimestamp(new Date(millis).toISOString());
  },
});

const TYPES = (yaml as unknown as { types: Record<string, yaml.Type> }).types;

const SNAKE_SCHEMA = yaml.FAILSAFE_SCHEMA.extend({
  implicit: [nullType, boolType, intType, floatType, timestampType, TYPES["merge"] as yaml.Type],
  explicit: ["binary", "omap", "pairs", "set"].map((t) => TYPES[t] as yaml.Type),
});

function toJava(value: unknown): unknown {
  if (value instanceof YamlTimestamp) return value.iso;
  if (value instanceof JavaInt || value instanceof JavaDouble) return value;
  if (value instanceof Uint8Array) return value;
  if (Array.isArray(value)) return value.map(toJava);
  if (typeof value === "object" && value !== null) {
    return new Map(Object.entries(value).map(([k, v]) => [k, toJava(v)]));
  }
  return value;
}
