/**
 * Translation of Java (`java.util.regex`) patterns to JavaScript, for the places where WireMock,
 * Jayway JsonPath and XMLUnit compile a Java regex: WireMock `matches` / `doesNotMatch`, JSONPath
 * `=~` filters, the XMLUnit `matchesRegex` placeholder and the verifier's `by_regex` matcher.
 *
 * Java and JavaScript disagree on more than syntax: `\s` is ASCII in Java and Unicode in
 * JavaScript, `$` also matches before a final line terminator in Java, `(?i)` folds ASCII only,
 * `\p{L}` is a literal "p{L}" in JavaScript without the `u` flag, a "-" next to `\s` inside a class
 * is a literal in Java and a range in JavaScript, and so on. Every construct is therefore
 * translated explicitly and the result always compiles in Unicode mode (so "." and negated classes
 * consume whole code points, as in Java), with case-insensitivity spelled out rather than left to
 * JavaScript's Unicode case folding. Anything that cannot be reproduced faithfully makes the
 * function return `null`, so the caller can report the regex as unsupported instead of matching
 * something Java would not.
 */

/** Options for {@link javaRegex}. */
export interface JavaRegexOptions {
  /** `"full"`: `Matcher.matches()` (default). `"find"`: `Matcher.find()`. */
  readonly mode?: "full" | "find";
  /** `Pattern.DOTALL`: WireMock always sets it; Jayway and XMLUnit do not. Default `true`. */
  readonly dotAll?: boolean;
  /** Java flag letters set by the caller (e.g. Jayway's `/re/i`): `i`, `m`, `s`, `u`, `x`, `d`. */
  readonly javaFlags?: string;
}

/** {@link javaRegex} with whole-value matching, as WireMock's string matchers use it. */
export function javaFullMatchRegex(
  pattern: string,
  options?: Omit<JavaRegexOptions, "mode">,
): RegExp | null {
  return javaRegex(pattern, { ...options, mode: "full" });
}

/** Translate and compile a Java regex. Returns `null` when JavaScript cannot reproduce it. */
export function javaRegex(pattern: string, options?: JavaRegexOptions): RegExp | null {
  const flags = new Set<string>(options?.javaFlags ?? "");
  if (options?.dotAll !== false) flags.add("s");

  let source = pattern;
  // Leading flag groups: (?i), (?is), (?s)(?i)…
  for (let m = LEADING_FLAGS.exec(source); m !== null; m = LEADING_FLAGS.exec(source)) {
    for (const flag of m[1] ?? "") flags.add(flag);
    source = source.slice(m[0].length);
  }
  for (const flag of flags) {
    // x (comments), d (UNIX_LINES), U (UNICODE_CHARACTER_CLASS), c (CANON_EQ): no equivalent.
    if (!"imsu".includes(flag)) return null;
  }
  // Java's UNICODE_CASE folding (?iu) differs from JavaScript's in too many places (ß, the
  // Kelvin sign with \w, dotted İ…) to reproduce.
  if (flags.has("i") && flags.has("u")) return null;

  const translated = new Translator(source, {
    dotAll: flags.has("s"),
    multiline: flags.has("m"),
    asciiFold: flags.has("i"),
  }).translate();
  if (translated === null) return null;

  const body = options?.mode === "find" ? translated : `(?<![\\s\\S])(?:${translated})(?![\\s\\S])`;
  try {
    // eslint-disable-next-line security/detect-non-literal-regexp -- translated, validated pattern
    return new RegExp(body, "u");
  } catch {
    return null;
  }
}

const LEADING_FLAGS = /^\(\?([a-zA-Z]+)\)/;

interface TranslateContext {
  readonly dotAll: boolean;
  readonly multiline: boolean;
  /** Java CASE_INSENSITIVE without UNICODE_CASE: ASCII letters only. */
  readonly asciiFold: boolean;
}

/** Java line terminators (for ".", "^" and "$"). */
const LINE_TERMINATORS = "\\n\\r\\u0085\\u2028\\u2029";
const JAVA_SPACE = "\\t\\n\\u000B\\f\\r ";
const JAVA_HSPACE = " \\t\\u00A0\\u1680\\u180E\\u2000-\\u200A\\u202F\\u205F\\u3000";
const JAVA_VSPACE = "\\n\\u000B\\f\\r\\u0085\\u2028\\u2029";
/** Everything but Java `\s`, for use inside a class (`[\S\s]` is common in SCC patterns). */
const NOT_JAVA_SPACE = "\\u0000-\\u0008\\u000E-\\u001F\\u0021-\\u{10FFFF}";
/** java.lang.Character.isWhitespace: space separators except no-break spaces, and \t-\r, \x1C-\x1F. */
const JAVA_WHITESPACE =
  "\\t-\\r\\u001C-\\u0020\\u1680\\u2000-\\u2006\\u2008-\\u200A\\u2028\\u2029\\u205F\\u3000";

/** Java's POSIX and java.lang.Character classes (\p{Alpha}, \p{javaLowerCase}…). */
const JAVA_CLASSES: ReadonlyMap<string, string> = new Map([
  ["Lower", "a-z"],
  ["Upper", "A-Z"],
  ["ASCII", "\\u0000-\\u007F"],
  ["Alpha", "a-zA-Z"],
  ["Digit", "0-9"],
  ["Alnum", "a-zA-Z0-9"],
  ["Punct", "!-\\/:-@\\[-`{-~"],
  ["Graph", "!-~"],
  ["Print", " -~"],
  ["Blank", " \\t"],
  ["Cntrl", "\\u0000-\\u001F\\u007F"],
  ["XDigit", "0-9a-fA-F"],
  ["Space", " \\t\\n\\u000B\\f\\r"],
  ["javaLowerCase", "\\p{Lowercase}"],
  ["javaUpperCase", "\\p{Uppercase}"],
  ["javaWhitespace", JAVA_WHITESPACE],
  ["javaAlphabetic", "\\p{Alphabetic}"],
  ["javaDigit", "\\p{Nd}"],
  ["javaLetter", "\\p{L}"],
  ["javaLetterOrDigit", "\\p{L}\\p{Nd}"],
]);

/** One element of a character class: a code point, or a set (`\d`, `\p{L}`…) as class body text. */
type ClassAtom =
  { readonly kind: "char"; readonly cp: number } | { readonly kind: "set"; readonly text: string };

/** An escape outside a class: a single code point, or ready-made JavaScript text. */
type Escape =
  | { readonly kind: "char"; readonly cp: number; readonly end: number }
  | { readonly kind: "text"; readonly text: string; readonly end: number };

class Translator {
  private pos = 0;
  private out = "";

  constructor(
    private readonly source: string,
    private readonly context: TranslateContext,
  ) {}

  translate(): string | null {
    const s = this.source;
    while (this.pos < s.length) {
      const ch = s.charAt(this.pos);
      const cp = s.codePointAt(this.pos) ?? 0;
      if (ch === "\\") {
        if (s.charAt(this.pos + 1) === "Q") {
          for (const c of this.quoted()) this.out += this.char(c);
          continue;
        }
        const escape = this.escape(this.pos);
        if (escape === null) return null;
        this.out += escape.kind === "char" ? this.char(escape.cp) : escape.text;
        this.pos = escape.end;
        continue;
      }
      switch (ch) {
        case "[": {
          const cls = this.characterClass();
          if (cls === null) return null;
          this.out += cls;
          continue;
        }
        case "(": {
          const group = /^\(\?(:|=|!|<=|<!|<[a-zA-Z][a-zA-Z0-9]*>)/.exec(s.slice(this.pos));
          if (s.startsWith("(?", this.pos) && group === null) {
            return null; // (?>…) atomic, (?i:…) scoped flags, (?flags) mid-pattern
          }
          const text = group === null ? "(" : group[0];
          this.out += text;
          this.pos += text.length;
          continue;
        }
        case ".":
          this.out += this.context.dotAll ? "[\\s\\S]" : `[^${LINE_TERMINATORS}]`;
          break;
        case "^":
          // MULTILINE: after a line terminator (not inside \r\n), never at the end of input.
          this.out += this.context.multiline
            ? "(?:(?<![\\s\\S])(?=[\\s\\S])|(?<=[\\n\\u0085\\u2028\\u2029]|\\r(?!\\n))(?=[\\s\\S]))"
            : "(?<![\\s\\S])";
          break;
        case "$":
          this.out += this.context.multiline
            ? "(?=[\\r\\u0085\\u2028\\u2029]|(?<!\\r)\\n|(?![\\s\\S]))"
            : `(?=(?:\\r\\n|[${LINE_TERMINATORS}])?(?![\\s\\S]))`;
          break;
        case "*":
        case "+":
        case "?": {
          const after = s.charAt(this.pos + 1);
          if (after === "+") return null; // possessive quantifier
          this.out += ch;
          if (after === "?") {
            this.out += "?";
            this.pos++;
          }
          break;
        }
        case "{": {
          const quantifier = /^\{\d+(,\d*)?\}/.exec(s.slice(this.pos));
          if (quantifier === null) return null; // Java rejects a "{" that is not a quantifier
          this.pos += quantifier[0].length;
          if (s.charAt(this.pos) === "+") return null;
          this.out += quantifier[0];
          if (s.charAt(this.pos) === "?") {
            this.out += "?";
            this.pos++;
          }
          continue;
        }
        case "}":
        case "]":
        case "/":
          this.out += `\\${ch}`; // literals in Java; "}" and "]" must be escaped in Unicode mode
          break;
        case "|":
        case ")":
          this.out += ch;
          break;
        default:
          this.out += this.char(cp);
          this.pos += cp > 0xffff ? 2 : 1;
          continue;
      }
      this.pos++;
    }
    return this.out;
  }

  /** A literal code point outside a class, case-folded for ASCII (?i). */
  private char(cp: number): string {
    if (this.context.asciiFold && isAsciiLetter(cp)) {
      return `[${String.fromCharCode(cp)}${String.fromCharCode(cp ^ 0x20)}]`;
    }
    return escapeCodePoint(cp, /[\\^$.*+?()[\]{}|/]/);
  }

  /** The code points of \Q…\E starting at this.pos; advances past it. */
  private quoted(): number[] {
    const end = this.source.indexOf("\\E", this.pos + 2);
    const text = this.source.slice(this.pos + 2, end === -1 ? this.source.length : end);
    this.pos = end === -1 ? this.source.length : end + 2;
    return [...text].map((c) => c.codePointAt(0) ?? 0);
  }

  /**
   * A whole character class, parsed into atoms first: a "-" is a range only between two single
   * characters (next to a set such as \s or \d it is a literal, as in Java), and ASCII (?i) adds
   * the other case of letters and letter ranges.
   */
  private characterClass(): string | null {
    const s = this.source;
    this.pos++; // "["
    let negated = false;
    if (s.charAt(this.pos) === "^") {
      negated = true;
      this.pos++;
    }
    const atoms: (ClassAtom | { readonly kind: "dash" })[] = [];
    let first = true;
    for (;;) {
      if (this.pos >= s.length) return null;
      const ch = s.charAt(this.pos);
      if (ch === "]" && !first) {
        this.pos++;
        break;
      }
      first = false;
      if (ch === "[") return null; // Java nested class (union)
      if (ch === "&" && s.charAt(this.pos + 1) === "&") return null; // Java intersection
      if (ch === "-") {
        atoms.push({ kind: "dash" });
        this.pos++;
        continue;
      }
      if (ch === "\\") {
        if (s.charAt(this.pos + 1) === "Q") {
          for (const cp of this.quoted()) atoms.push({ kind: "char", cp });
          continue;
        }
        const atom = this.classEscape();
        if (atom === null) return null;
        atoms.push(atom);
        continue;
      }
      const cp = s.codePointAt(this.pos) ?? 0;
      atoms.push({ kind: "char", cp });
      this.pos += cp > 0xffff ? 2 : 1;
    }

    let body = "";
    for (let i = 0; i < atoms.length; i++) {
      const atom = atoms[i] as ClassAtom | { kind: "dash" };
      const dash = atoms[i + 1];
      const end = atoms[i + 2];
      if (atom.kind === "char" && dash?.kind === "dash" && end?.kind === "char") {
        if (end.cp < atom.cp) return null; // Java: illegal character range
        body += this.classRange(atom.cp, end.cp);
        i += 2;
        continue;
      }
      if (atom.kind === "dash") {
        // Java: a "-" next to a set (\s-x) is a literal; a range ending in a set is an error.
        if (i > 0 && atoms[i - 1]?.kind === "char" && atoms[i + 1]?.kind === "set") return null;
        body += "\\-";
      } else if (atom.kind === "set") {
        body += atom.text;
      } else {
        body += this.classChar(atom.cp);
      }
    }
    return `[${negated ? "^" : ""}${body}]`;
  }

  private classChar(cp: number): string {
    const text = escapeCodePoint(cp, /[\\\]^-]/);
    if (this.context.asciiFold && isAsciiLetter(cp)) return text + String.fromCharCode(cp ^ 0x20);
    return text;
  }

  private classRange(lo: number, hi: number): string {
    let text = `${escapeCodePoint(lo, /[\\\]^-]/)}-${escapeCodePoint(hi, /[\\\]^-]/)}`;
    if (this.context.asciiFold) {
      // The other case of the ASCII letters the range covers.
      for (const [start, end] of [
        [0x41, 0x5a],
        [0x61, 0x7a],
      ] as const) {
        const a = Math.max(lo, start);
        const b = Math.min(hi, end);
        if (a <= b) text += `${String.fromCharCode(a ^ 0x20)}-${String.fromCharCode(b ^ 0x20)}`;
      }
    }
    return text;
  }

  /** An escape inside a class, as an atom; advances past it. */
  private classEscape(): ClassAtom | null {
    const next = this.source.charAt(this.pos + 1);
    const set = (text: string, length = 2): ClassAtom => {
      this.pos += length;
      return { kind: "set", text };
    };
    switch (next) {
      case "d":
      case "D":
      case "w":
      case "W":
        return set(`\\${next}`);
      case "s":
        return set(JAVA_SPACE);
      case "S":
        return set(NOT_JAVA_SPACE);
      case "h":
        return set(JAVA_HSPACE);
      case "v":
        return set(JAVA_VSPACE);
      case "H":
      case "V":
      case "R":
      case "A":
      case "z":
      case "Z":
      case "b":
      case "B":
      case "k":
        return null;
      case "p":
      case "P": {
        const property = this.property(true);
        if (property === null) return null;
        return { kind: "set", text: property };
      }
      default: {
        if (/[1-9]/.test(next)) return null; // no back references in a class
        const escape = this.escape(this.pos);
        if (escape === null || escape.kind !== "char") return null;
        this.pos = escape.end;
        return { kind: "char", cp: escape.cp };
      }
    }
  }

  /** An escape outside a class (also single-character escapes inside one). */
  private escape(at: number): Escape | null {
    const s = this.source;
    const next = s.charAt(at + 1);
    const text = (t: string, length = 2): Escape => ({ kind: "text", text: t, end: at + length });
    const char = (cp: number, length: number): Escape | null =>
      cp > 0x10ffff ? null : { kind: "char", cp, end: at + length };
    switch (next) {
      case "d":
      case "D":
      case "w":
      case "W":
      case "b":
      case "B":
        return text(`\\${next}`);
      case "t":
        return char(0x09, 2);
      case "n":
        return char(0x0a, 2);
      case "r":
        return char(0x0d, 2);
      case "f":
        return char(0x0c, 2);
      case "a":
        return char(0x07, 2);
      case "e":
        return char(0x1b, 2);
      case "s":
        return text(`[${JAVA_SPACE}]`);
      case "S":
        return text(`[^${JAVA_SPACE}]`);
      case "h":
        return text(`[${JAVA_HSPACE}]`);
      case "H":
        return text(`[^${JAVA_HSPACE}]`);
      case "v":
        return text(`[${JAVA_VSPACE}]`);
      case "V":
        return text(`[^${JAVA_VSPACE}]`);
      case "R":
        return text(`(?:\\r\\n|[${JAVA_VSPACE}])`);
      case "A":
        return text("(?<![\\s\\S])");
      case "z":
        return text("(?![\\s\\S])");
      case "Z":
        return text(`(?=(?:\\r\\n|[${LINE_TERMINATORS}])?(?![\\s\\S]))`);
      case "c": {
        // Java: the control character is the letter's code XOR 64 (\ca is "!", \cA is U+0001).
        const letter = s.codePointAt(at + 2);
        if (letter === undefined || letter > 0x7f) return null;
        return char(letter ^ 0x40, 3);
      }
      case "x": {
        if (s.charAt(at + 2) === "{") {
          const end = s.indexOf("}", at + 3);
          const hex = end === -1 ? "" : s.slice(at + 3, end);
          if (!/^[0-9a-fA-F]+$/.test(hex)) return null;
          return char(Number.parseInt(hex, 16), end - at + 1);
        }
        const hex = s.slice(at + 2, at + 4);
        return /^[0-9a-fA-F]{2}$/.test(hex) ? char(Number.parseInt(hex, 16), 4) : null;
      }
      case "u": {
        const hex = s.slice(at + 2, at + 6);
        return /^[0-9a-fA-F]{4}$/.test(hex) ? char(Number.parseInt(hex, 16), 6) : null;
      }
      case "0": {
        // Octal: \0n, \0nn, \0mnn (m <= 3)
        const octal = /^[0-3]?[0-7]{1,2}|^[0-7]/.exec(s.slice(at + 2));
        if (octal === null) return null;
        let digits = octal[0];
        if (digits.length === 3 && Number.parseInt(digits, 8) > 0o377) digits = digits.slice(0, 2);
        return char(Number.parseInt(digits, 8), 2 + digits.length);
      }
      case "p":
      case "P": {
        const saved = this.pos;
        this.pos = at;
        const property = this.property(false);
        const end = this.pos;
        this.pos = saved;
        return property === null ? null : { kind: "text", text: property, end };
      }
      default:
        break;
    }
    // Back references: a quantifier would bind differently, and a reference to a group that did
    // not participate fails in Java but matches empty in JavaScript. Not reproduced.
    if (/[1-9]/.test(next) || next === "k") return null;
    if (/[a-zA-Z]/.test(next)) return null; // \N{…}, \X, \G and unknown escapes
    // Escaped punctuation: a literal.
    const cp = s.codePointAt(at + 1) ?? 0;
    return char(cp, cp > 0xffff ? 3 : 2);
  }

  /** \p{…} / \P{…} at this.pos as JavaScript text (class body text when `inClass`). */
  private property(inClass: boolean): string | null {
    const s = this.source;
    const at = this.pos;
    const negated = s.charAt(at + 1) === "P";
    let name: string;
    if (s.charAt(at + 2) === "{") {
      const close = s.indexOf("}", at + 3);
      if (close === -1) return null;
      name = s.slice(at + 3, close);
      this.pos = close + 1;
    } else {
      name = s.charAt(at + 2);
      if (!/[A-Za-z]/.test(name)) return null;
      this.pos = at + 3;
    }
    // Java's case-insensitive matching of property classes is not reproduced.
    if (this.context.asciiFold) return null;
    const javaClass = JAVA_CLASSES.get(name);
    if (javaClass !== undefined) {
      if (negated) return inClass ? null : `[^${javaClass}]`;
      return inClass ? javaClass : `[${javaClass}]`;
    }
    const js = javaPropertyName(name);
    if (js === null) return null;
    return `${negated ? "\\P" : "\\p"}{${js}}`;
  }
}

function isAsciiLetter(cp: number): boolean {
  return (cp >= 0x41 && cp <= 0x5a) || (cp >= 0x61 && cp <= 0x7a);
}

/** A code point as Unicode-mode JavaScript regex text, escaping the given syntax characters. */
function escapeCodePoint(cp: number, special: RegExp): string {
  if (cp > 0xffff) return `\\u{${cp.toString(16)}}`;
  if (cp < 0x20 || (cp >= 0x7f && cp <= 0xa0)) return `\\u${cp.toString(16).padStart(4, "0")}`;
  const ch = String.fromCharCode(cp);
  if (cp >= 0xd800 && cp <= 0xdfff) return `\\u${cp.toString(16)}`;
  return special.test(ch) ? `\\${ch}` : ch;
}

/**
 * Java property names JavaScript understands: general categories (L, Lu, …, also as IsL),
 * scripts (IsLatin, script=Latin), binary properties (IsAlphabetic). Bare long names such as
 * \p{Letter} or \p{Alphabetic}, and \p{IsAny}, are rejected by Java, and so here.
 */
function javaPropertyName(name: string): string | null {
  if (/^[A-Z][a-z]?$/.test(name)) return isValidProperty(name) ? name : null; // category: L, Lu
  if (name.startsWith("In") || /^(block|blk)=/i.test(name)) return null; // blocks
  if (name.startsWith("Is")) {
    const bare = name.slice(2);
    if (/^[A-Z][a-z]?$/.test(bare) && isValidProperty(bare)) return bare;
    if (isValidProperty(`Script=${bare}`)) return `Script=${bare}`;
    if (JAVA_BINARY_PROPERTIES.has(bare.toLowerCase()) && isValidProperty(bare)) return bare;
    return null;
  }
  const keyed = /^(script|sc|general_category|gc)=(.+)$/i.exec(name);
  if (keyed !== null) {
    const key = (keyed[1] ?? "").toLowerCase().startsWith("s") ? "Script" : "General_Category";
    const js = `${key}=${keyed[2] ?? ""}`;
    return isValidProperty(js) ? js : null;
  }
  return null;
}

/** The binary properties java.util.regex accepts as \p{IsX}. */
const JAVA_BINARY_PROPERTIES: ReadonlySet<string> = new Set([
  "alphabetic",
  "ideographic",
  "letter",
  "lowercase",
  "uppercase",
  "titlecase",
  "punctuation",
  "control",
  "white_space",
  "whitespace",
  "digit",
  "hex_digit",
  "hexdigit",
  "join_control",
  "joincontrol",
  "noncharacter_code_point",
  "noncharactercodepoint",
  "assigned",
  "emoji",
  "emoji_presentation",
  "emoji_modifier",
  "emoji_modifier_base",
  "emoji_component",
  "extended_pictographic",
]);

function isValidProperty(name: string): boolean {
  try {
    // eslint-disable-next-line security/detect-non-literal-regexp -- probing a property name
    new RegExp(`\\p{${name}}`, "u");
    return true;
  } catch {
    return false;
  }
}
