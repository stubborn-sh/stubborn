/**
 * Re-serializes a JSON value the way WireMock's Jackson `ObjectMapper` writes a `jsonBody`:
 * compact, object keys in document order (a repeated key keeps its first position and takes its
 * last value), integers exact, and decimals read as `BigDecimal` (trailing zeros kept) and written
 * in plain notation (`1.0` stays `1.0`, `1e2` is `100`). `JSON.parse` would lose all of that, so
 * the value is parsed from its source text.
 */

type Lossless =
  | { readonly kind: "literal"; readonly text: string }
  | { readonly kind: "array"; readonly items: readonly Lossless[] }
  | { readonly kind: "object"; readonly entries: ReadonlyMap<string, Lossless> };

/** The value at `path` (object keys) in a JSON document, written as Jackson would. */
export function jacksonJsonAt(text: string, path: readonly string[]): string | undefined {
  let node: Lossless | undefined = new Parser(text).document();
  for (const key of path) {
    node = node?.kind === "object" ? node.entries.get(key) : undefined;
  }
  return node === undefined ? undefined : write(node);
}

function write(node: Lossless): string {
  switch (node.kind) {
    case "literal":
      return node.text;
    case "array":
      return `[${node.items.map(write).join(",")}]`;
    case "object":
      return `{${[...node.entries].map(([k, v]) => `${JSON.stringify(k)}:${write(v)}`).join(",")}}`;
  }
}

/** Jackson's text for a JSON number literal (see the module comment). */
function jacksonNumber(literal: string): string {
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(literal);
  if (match === null) return literal;
  const [, sign = "", whole = "", fraction, exponent] = match;
  if (fraction === undefined && exponent === undefined) {
    // An integer node: exact, and "-0" is plain 0.
    const digits = whole.replace(/^0+(?=\d)/, "");
    return digits === "0" ? "0" : `${sign}${digits}`;
  }
  // BigDecimal(literal).toPlainString(): unscaled digits with scale = fraction digits - exponent.
  let unscaled = (whole + (fraction ?? "")).replace(/^0+(?=\d)/, "");
  const scale = (fraction ?? "").length - Number(exponent ?? "0");
  const negative = sign === "-" && /[1-9]/.test(unscaled);
  let plain: string;
  if (scale <= 0) {
    plain = unscaled === "0" ? "0" : unscaled + "0".repeat(-scale);
  } else {
    unscaled = unscaled.padStart(scale + 1, "0");
    plain = `${unscaled.slice(0, -scale)}.${unscaled.slice(-scale)}`;
  }
  return `${negative ? "-" : ""}${plain}`;
}

class Parser {
  private pos = 0;
  constructor(private readonly text: string) {}

  document(): Lossless {
    const value = this.value();
    this.space();
    if (this.pos !== this.text.length) throw new SyntaxError("Unexpected trailing JSON content");
    return value;
  }

  private space(): void {
    while (/[ \t\n\r]/.test(this.text.charAt(this.pos))) this.pos++;
  }

  private value(): Lossless {
    this.space();
    const ch = this.text.charAt(this.pos);
    if (ch === "{") return this.object();
    if (ch === "[") return this.array();
    if (ch === '"') return { kind: "literal", text: JSON.stringify(this.string()) };
    const literal = /^(?:true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(
      this.text.slice(this.pos),
    );
    if (literal === null) throw new SyntaxError(`Unexpected JSON at position ${this.pos}`);
    this.pos += literal[0].length;
    const text = literal[0];
    return { kind: "literal", text: /^[-\d]/.test(text) ? jacksonNumber(text) : text };
  }

  private string(): string {
    const start = this.pos;
    this.pos++;
    while (this.pos < this.text.length) {
      const ch = this.text.charAt(this.pos);
      if (ch === "\\") this.pos += 2;
      else if (ch === '"') break;
      else this.pos++;
    }
    this.pos++;
    return JSON.parse(this.text.slice(start, this.pos)) as string;
  }

  private array(): Lossless {
    this.pos++;
    const items: Lossless[] = [];
    this.space();
    if (this.text.charAt(this.pos) === "]") {
      this.pos++;
      return { kind: "array", items };
    }
    for (;;) {
      items.push(this.value());
      this.space();
      const ch = this.text.charAt(this.pos++);
      if (ch === "]") return { kind: "array", items };
      if (ch !== ",") throw new SyntaxError(`Unexpected JSON at position ${this.pos - 1}`);
    }
  }

  private object(): Lossless {
    this.pos++;
    const entries = new Map<string, Lossless>();
    this.space();
    if (this.text.charAt(this.pos) === "}") {
      this.pos++;
      return { kind: "object", entries };
    }
    for (;;) {
      this.space();
      if (this.text.charAt(this.pos) !== '"') {
        throw new SyntaxError(`Unexpected JSON at position ${this.pos}`);
      }
      const key = this.string();
      this.space();
      if (this.text.charAt(this.pos++) !== ":") {
        throw new SyntaxError(`Unexpected JSON at position ${this.pos - 1}`);
      }
      entries.set(key, this.value());
      this.space();
      const ch = this.text.charAt(this.pos++);
      if (ch === "}") return { kind: "object", entries };
      if (ch !== ",") throw new SyntaxError(`Unexpected JSON at position ${this.pos - 1}`);
    }
  }
}
