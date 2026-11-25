/**
 * The Java values a contract becomes on the JVM, so that the YAML → WireMock conversion can turn
 * them into text exactly as the JVM does: SnakeYAML's numbers (`Integer`, `Long`, `BigInteger`,
 * `Double`), Jackson's JSON reading and writing, `toString()` of maps and lists, `hashCode()` (the
 * JVM iterates `HashMap`/`HashSet` in hash order, and some of the generated WireMock patterns
 * come out in that order), and the few commons-text escapers the conversion uses.
 *
 * Maps are `Map<string, unknown>` (insertion ordered like `LinkedHashMap`), lists are arrays,
 * strings, booleans and `null` are themselves, binary content is a `Uint8Array`.
 */

/** A Java integral number: `Integer`, `Long` or `BigInteger`. */
export class JavaInt {
  constructor(
    readonly value: bigint,
    readonly type: "Integer" | "Long" | "BigInteger",
  ) {}

  /** The narrowest type SnakeYAML / Jackson pick for the value. */
  static of(value: bigint): JavaInt {
    if (value >= -(2n ** 31n) && value < 2n ** 31n) return new JavaInt(value, "Integer");
    if (value >= -(2n ** 63n) && value < 2n ** 63n) return new JavaInt(value, "Long");
    return new JavaInt(value, "BigInteger");
  }

  toString(): string {
    return this.value.toString();
  }
}

/** A Java `double`. */
export class JavaDouble {
  constructor(readonly value: number) {}

  toString(): string {
    return javaDoubleToString(this.value);
  }
}

export type JavaNumber = JavaInt | JavaDouble;

export function isJavaNumber(value: unknown): value is JavaNumber {
  return value instanceof JavaInt || value instanceof JavaDouble;
}

/** `Double.toString(d)` (JDK 19+: the shortest decimal that rounds to `d`). */
export function javaDoubleToString(d: number): string {
  if (Number.isNaN(d)) return "NaN";
  if (d === Infinity) return "Infinity";
  if (d === -Infinity) return "-Infinity";
  if (d === 0) return Object.is(d, -0) ? "-0.0" : "0.0";
  const sign = d < 0 ? "-" : "";
  const [mantissa = "", exp = "0"] = Math.abs(d).toExponential().split("e");
  const digits = mantissa.replace(".", "");
  const exponent = Number(exp);
  const abs = Math.abs(d);
  if (abs >= 1e-3 && abs < 1e7) {
    // Plain notation with at least one digit after the point.
    const point = exponent + 1;
    let text: string;
    if (point <= 0) text = `0.${"0".repeat(-point)}${digits}`;
    else if (point >= digits.length) text = `${digits}${"0".repeat(point - digits.length)}.0`;
    else text = `${digits.slice(0, point)}.${digits.slice(point)}`;
    return sign + text;
  }
  const fraction = digits.length > 1 ? digits.slice(1) : "0";
  return `${sign}${digits.charAt(0)}.${fraction}E${exponent}`;
}

/** `new BigDecimal(text).toPlainString()` for a Java number's text. */
export function bigDecimalPlain(text: string): string {
  const match = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(text);
  if (match === null) return text;
  const [, sign = "", whole = "", fraction = "", exponent = "0"] = match;
  let unscaled = (whole + fraction).replace(/^0+(?=\d)/, "");
  if (unscaled === "") unscaled = "0";
  const scale = fraction.length - Number(exponent);
  let plain: string;
  if (scale <= 0) {
    plain = unscaled === "0" ? "0" : unscaled + "0".repeat(-scale);
  } else {
    const padded = unscaled.padStart(scale + 1, "0");
    plain = `${padded.slice(0, -scale)}.${padded.slice(-scale)}`;
  }
  // A BigDecimal has no negative zero.
  return `${sign === "-" && /[1-9]/.test(unscaled) ? "-" : ""}${plain}`;
}

/** A `java.util.regex.Pattern` (its `toString()` is the pattern). */
export class JavaPattern {
  constructor(readonly pattern: string) {}

  toString(): string {
    return this.pattern;
  }
}

/** `Object.toString()` of a Java value: `{k=v, …}`, `[a, b]`, numbers as Java prints them. */
export function javaToString(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Map) {
    return `{${[...(value as Map<unknown, unknown>)].map(([k, v]) => `${javaToString(k)}=${javaToString(v)}`).join(", ")}}`;
  }
  if (Array.isArray(value)) return `[${value.map(javaToString).join(", ")}]`;
  if (value instanceof Uint8Array) return `[B@${(javaHashCode(value) >>> 0).toString(16)}`;
  return String(value);
}

// ---------------------------------------------------------------------------------------------
// hashCode / HashMap iteration order
// ---------------------------------------------------------------------------------------------

/** `String.hashCode()`. */
export function javaStringHash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  return h;
}

/** `hashCode()` of a Java value (as far as the conversion needs it). */
export function javaHashCode(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "string") return javaStringHash(value);
  if (typeof value === "boolean") return value ? 1231 : 1237;
  if (value instanceof JavaInt) {
    if (value.type === "Integer") return Number(BigInt.asIntN(32, value.value));
    if (value.type === "Long") {
      const v = BigInt.asUintN(64, value.value);
      return Number(BigInt.asIntN(32, v ^ (v >> 32n)));
    }
    return bigIntegerHash(value.value);
  }
  if (value instanceof JavaDouble) {
    const view = new DataView(new ArrayBuffer(8));
    view.setFloat64(0, Number.isNaN(value.value) ? NaN : value.value);
    return (view.getInt32(0) ^ view.getInt32(4)) | 0;
  }
  if (value instanceof JavaPattern) return javaStringHash(value.pattern);
  if (Array.isArray(value)) return objectsHash(...(value as unknown[]));
  if (value instanceof Map) {
    let h = 0;
    for (const [k, v] of value as Map<unknown, unknown>)
      h = (h + (javaHashCode(k) ^ javaHashCode(v))) | 0;
    return h;
  }
  if (value instanceof Uint8Array) {
    let h = 0;
    for (const b of value) h = (Math.imul(31, h) + b) | 0;
    return h;
  }
  const custom = (value as { javaHashCode?: () => number }).javaHashCode;
  return typeof custom === "function" ? custom.call(value) : 0;
}

/** `BigInteger.hashCode()`. */
function bigIntegerHash(value: bigint): number {
  const negative = value < 0n;
  let magnitude = negative ? -value : value;
  const words: number[] = [];
  while (magnitude > 0n) {
    words.unshift(Number(magnitude & 0xffffffffn));
    magnitude >>= 32n;
  }
  let h = 0;
  for (const word of words) h = (Math.imul(31, h) + word) | 0;
  return negative ? -h | 0 : h;
}

/** `Objects.hash(values…)`. */
export function objectsHash(...values: unknown[]): number {
  let h = 1;
  for (const v of values) h = (Math.imul(31, h) + javaHashCode(v)) | 0;
  return h;
}

/**
 * The iteration order of a `java.util.HashMap` / `HashSet` holding entries with these hash codes,
 * inserted in this order: by bucket (`(h ^ h >>> 16) & (capacity - 1)`), then insertion order.
 */
export function hashMapOrder<T>(entries: readonly T[], hash: (entry: T) => number): T[] {
  let capacity = 16;
  while (entries.length > capacity * 0.75) capacity *= 2;
  return entries
    .map((entry, index) => {
      const h = hash(entry);
      return { entry, index, bucket: (h ^ (h >>> 16)) & (capacity - 1) };
    })
    .sort((a, b) => a.bucket - b.bucket || a.index - b.index)
    .map(({ entry }) => entry);
}

// ---------------------------------------------------------------------------------------------
// Jackson
// ---------------------------------------------------------------------------------------------

/**
 * `new JsonMapper().readValue(text, Object.class)` (Jackson 3 defaults): strict JSON, any value
 * at the top level, no trailing content; objects as maps (a repeated key keeps its first
 * position and takes its last value), integers as `Integer`/`Long`/`BigInteger`, decimals as
 * `Double`. Throws on anything Jackson rejects.
 */
export function jacksonRead(text: string): unknown {
  return new JacksonParser(text).document();
}

/** Like {@link jacksonRead}, but `undefined` instead of an exception. */
export function tryJacksonRead(text: string): { readonly value: unknown } | undefined {
  try {
    return { value: jacksonRead(text) };
  } catch {
    return undefined;
  }
}

class JacksonParser {
  private pos = 0;
  constructor(private readonly text: string) {}

  document(): unknown {
    this.space();
    if (this.pos >= this.text.length) throw new SyntaxError("No content to map");
    const value = this.value(0);
    this.space();
    if (this.pos !== this.text.length) throw new SyntaxError("Trailing token");
    return value;
  }

  private fail(): never {
    throw new SyntaxError(`Unexpected JSON at position ${this.pos}`);
  }

  private space(): void {
    for (;;) {
      const c = this.text.charCodeAt(this.pos);
      if (c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d) this.pos++;
      else return;
    }
  }

  private value(depth: number): unknown {
    if (depth > 1000) this.fail();
    this.space();
    const ch = this.text.charAt(this.pos);
    if (ch === "{") return this.object(depth);
    if (ch === "[") return this.array(depth);
    if (ch === '"') return this.string();
    for (const [word, value] of [
      ["true", true],
      ["false", false],
      ["null", null],
    ] as const) {
      if (this.text.startsWith(word, this.pos)) {
        this.pos += word.length;
        if (/[A-Za-z0-9_$]/.test(this.text.charAt(this.pos))) this.fail();
        return value;
      }
    }
    const number = /^-?(?:0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(this.text.slice(this.pos));
    if (number === null) this.fail();
    this.pos += number[0].length;
    if (/[A-Za-z0-9_.]/.test(this.text.charAt(this.pos))) this.fail();
    if (number[1] === undefined && number[2] === undefined) return JavaInt.of(BigInt(number[0]));
    return new JavaDouble(Number(number[0]));
  }

  private string(): string {
    this.pos++;
    let out = "";
    for (;;) {
      if (this.pos >= this.text.length) this.fail();
      const c = this.text.charCodeAt(this.pos);
      if (c === 0x22) {
        this.pos++;
        return out;
      }
      if (c < 0x20) this.fail();
      if (c === 0x5c) {
        const e = this.text.charAt(this.pos + 1);
        const simple: Record<string, string> = {
          '"': '"',
          "\\": "\\",
          "/": "/",
          b: "\b",
          f: "\f",
          n: "\n",
          r: "\r",
          t: "\t",
        };
        if (simple[e] !== undefined) {
          out += simple[e];
          this.pos += 2;
        } else if (e === "u") {
          const hex = this.text.slice(this.pos + 2, this.pos + 6);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) this.fail();
          out += String.fromCharCode(parseInt(hex, 16));
          this.pos += 6;
        } else this.fail();
      } else {
        out += this.text.charAt(this.pos);
        this.pos++;
      }
    }
  }

  private array(depth: number): unknown[] {
    this.pos++;
    const items: unknown[] = [];
    this.space();
    if (this.text.charAt(this.pos) === "]") {
      this.pos++;
      return items;
    }
    for (;;) {
      items.push(this.value(depth + 1));
      this.space();
      const ch = this.text.charAt(this.pos++);
      if (ch === "]") return items;
      if (ch !== ",") this.fail();
    }
  }

  private object(depth: number): Map<string, unknown> {
    this.pos++;
    const entries = new Map<string, unknown>();
    this.space();
    if (this.text.charAt(this.pos) === "}") {
      this.pos++;
      return entries;
    }
    for (;;) {
      this.space();
      if (this.text.charAt(this.pos) !== '"') this.fail();
      const key = this.string();
      this.space();
      if (this.text.charAt(this.pos++) !== ":") this.fail();
      entries.set(key, this.value(depth + 1));
      this.space();
      const ch = this.text.charAt(this.pos++);
      if (ch === "}") return entries;
      if (ch !== ",") this.fail();
    }
  }
}

/** `new JsonMapper().writeValueAsString(value)` for Java values: compact, Jackson's escaping. */
export function jacksonWrite(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return jacksonString(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof JavaInt) return value.toString();
  if (value instanceof JavaDouble) {
    return Number.isFinite(value.value) ? value.toString() : jacksonString(value.toString());
  }
  if (value instanceof Map) {
    return `{${[...(value as Map<unknown, unknown>)].map(([k, v]) => `${jacksonString(javaToString(k))}:${jacksonWrite(v)}`).join(",")}}`;
  }
  if (Array.isArray(value)) return `[${value.map(jacksonWrite).join(",")}]`;
  if (value instanceof Uint8Array) return jacksonString(Buffer.from(value).toString("base64"));
  return jacksonString(String(value));
}

/** A JSON string literal as Jackson writes it (`\uXXXX` in upper case for control characters). */
export function jacksonString(text: string): string {
  let out = '"';
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c === 0x22) out += '\\"';
    else if (c === 0x5c) out += "\\\\";
    else if (c < 0x20) {
      const named: Record<number, string> = { 8: "b", 9: "t", 10: "n", 12: "f", 13: "r" };
      const n = named[c];
      out += n !== undefined ? `\\${n}` : `\\u${c.toString(16).toUpperCase().padStart(4, "0")}`;
    } else out += text.charAt(i);
  }
  return `${out}"`;
}

// ---------------------------------------------------------------------------------------------
// commons-text / java.util.regex helpers
// ---------------------------------------------------------------------------------------------

/** commons-text `StringEscapeUtils.escapeJava`. */
export function escapeJava(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    const ch = text.charAt(i);
    if (ch === '"') out += '\\"';
    else if (ch === "\\") out += "\\\\";
    else if (c === 8) out += "\\b";
    else if (c === 10) out += "\\n";
    else if (c === 9) out += "\\t";
    else if (c === 12) out += "\\f";
    else if (c === 13) out += "\\r";
    else if (c < 32 || c > 0x7f) out += `\\u${c.toString(16).toUpperCase().padStart(4, "0")}`;
    else out += ch;
  }
  return out;
}

/** commons-text `StringEscapeUtils.unescapeEcmaScript` (= `unescapeJava`). */
export function unescapeEcmaScript(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    if (ch !== "\\" || i === text.length - 1) {
      out += ch;
      continue;
    }
    const next = text.charAt(i + 1);
    const simple: Record<string, string> = {
      "\\": "\\",
      '"': '"',
      "'": "'",
      b: "\b",
      n: "\n",
      t: "\t",
      f: "\f",
      r: "\r",
    };
    if (simple[next] !== undefined) {
      out += simple[next];
      i++;
      continue;
    }
    if (next === "u") {
      let j = i + 1;
      while (text.charAt(j) === "u") j++;
      if (text.charAt(j) === "+") j++;
      const hex = text.slice(j, j + 4);
      if (/^[0-9a-fA-F]{4}$/.test(hex)) {
        out += String.fromCharCode(parseInt(hex, 16));
        i = j + 3;
        continue;
      }
      out += ch;
      continue;
    }
    const octal = /^[0-7]{1,3}/.exec(text.slice(i + 1));
    if (octal !== null) {
      let digits = octal[0];
      if (digits.length === 3 && digits.charAt(0) > "3") digits = digits.slice(0, 2);
      out += String.fromCharCode(parseInt(digits, 8));
      i += digits.length;
      continue;
    }
    out += ch;
  }
  return out;
}

/** `Pattern.quote(text)`. */
export function patternQuote(text: string): string {
  if (!text.includes("\\E")) return `\\Q${text}\\E`;
  let out = "\\Q";
  let current = 0;
  for (;;) {
    const index = text.indexOf("\\E", current);
    if (index < 0) break;
    out += `${text.slice(current, index)}\\E\\\\E\\Q`;
    current = index + 2;
  }
  return `${out}${text.slice(current)}\\E`;
}

/** `Character.isWhitespace`-based `StringUtils.isBlank`. */
export function isBlank(text: string | null | undefined): boolean {
  return text === null || text === undefined || /^[\s\u001c-\u001f]*$/.test(text);
}
