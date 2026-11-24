/**
 * Translation of Java (`java.util.regex`) patterns to JavaScript, for the places where WireMock,
 * Jayway JsonPath and XMLUnit compile a Java regex: WireMock `matches` / `doesNotMatch`, JSONPath
 * `=~` filters, the XMLUnit `matchesRegex` placeholder and the verifier's `by_regex` matcher.
 *
 * Java and JavaScript disagree on more than syntax: `\s` is ASCII in Java and Unicode in
 * JavaScript, `$` also matches before a final line terminator in Java, `(?i)` is ASCII-only unless
 * `(?u)` is set, `\p{L}` is a literal "p{L}" in JavaScript without the `u` flag, and so on. Every
 * construct is therefore translated explicitly; anything that cannot be reproduced faithfully makes
 * the function return `null` so the caller can report the regex as unsupported instead of
 * matching something Java would not.
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
  for (
    let inline = /^\(\?([a-zA-Z]+)\)/.exec(source);
    inline !== null;
    inline = /^\(\?([a-zA-Z]+)\)/.exec(source)
  ) {
    for (const flag of inline[1] ?? "") flags.add(flag);
    source = source.slice(inline[0].length);
  }
  for (const flag of flags) {
    // x (comments), d (UNIX_LINES), U (UNICODE_CHARACTER_CLASS), c (CANON_EQ): no equivalent.
    if (!"imsu".includes(flag)) return null;
  }

  const translated = translate(source, {
    dotAll: flags.has("s"),
    multiline: flags.has("m"),
    groupCount: countGroups(source),
  });
  if (translated === null) return null;

  const caseInsensitive = flags.has("i");
  const unicodeCase = caseInsensitive && flags.has("u");
  // Java's (?i) folds ASCII only; JavaScript's folds every script. Refuse non-ASCII then.
  if (caseInsensitive && !unicodeCase && translated.nonAscii) return null;

  // Unicode mode makes ".", negated classes and \S consume a whole code point, as Java does. Not
  // with ASCII-only (?i), where it would also fold "k" to the Kelvin sign and "s" to "ſ".
  if (caseInsensitive && !unicodeCase && translated.unicode) return null;
  const unicode = !caseInsensitive || unicodeCase;
  const jsFlags = `${caseInsensitive ? "i" : ""}${unicode ? "u" : ""}`;
  const translatedSource = unicode
    ? translated.source.replaceAll(NOT_JAVA_SPACE_BMP, NOT_JAVA_SPACE_ASTRAL)
    : translated.source;
  const body =
    options?.mode === "find"
      ? translatedSource
      : `(?<![\\s\\S])(?:${translatedSource})(?![\\s\\S])`;
  try {
    return new RegExp(body, jsFlags);
  } catch {
    return null;
  }
}

interface TranslateContext {
  readonly dotAll: boolean;
  readonly multiline: boolean;
  readonly groupCount: number;
}

interface Translation {
  readonly source: string;
  /** Needs the JavaScript `u` flag (Unicode property classes, astral code points). */
  readonly unicode: boolean;
  /** Contains a non-ASCII character or class (matters for ASCII-only case folding). */
  readonly nonAscii: boolean;
}

const LINE_TERMINATORS = "\\n\\r\\x85\\u2028\\u2029";
const JAVA_SPACE = "\\t\\n\\x0B\\f\\r ";
const JAVA_HSPACE = " \\t\\xA0\\u1680\\u180E\\u2000-\\u200A\\u202F\\u205F\\u3000";
const JAVA_VSPACE = "\\n\\x0B\\f\\r\\x85\\u2028\\u2029";
/** Everything but Java `\s`, for use inside a class (`[\S\s]` is common in SCC patterns). */
const NOT_JAVA_SPACE_BMP = "\\x00-\\x08\\x0E-\\x1F\\x21-\\uFFFF";
const NOT_JAVA_SPACE_ASTRAL = "\\x00-\\x08\\x0E-\\x1F\\x21-\\u{10FFFF}";

/** Java's POSIX and java.lang.Character classes (\p{Alpha}, \p{javaLowerCase}…). */
const JAVA_CLASSES: ReadonlyMap<string, string> = new Map([
  ["Lower", "a-z"],
  ["Upper", "A-Z"],
  ["ASCII", "\\x00-\\x7F"],
  ["Alpha", "a-zA-Z"],
  ["Digit", "0-9"],
  ["Alnum", "a-zA-Z0-9"],
  ["Punct", "!-\\/:-@\\[-`{-~"],
  ["Graph", "!-~"],
  ["Print", " -~"],
  ["Blank", " \\t"],
  ["Cntrl", "\\x00-\\x1F\\x7F"],
  ["XDigit", "0-9a-fA-F"],
  ["Space", " \\t\\n\\x0B\\f\\r"],
  ["javaLowerCase", "\\p{Lowercase}"],
  ["javaUpperCase", "\\p{Uppercase}"],
  ["javaWhitespace", "\\p{White_Space}"],
  ["javaAlphabetic", "\\p{Alphabetic}"],
  ["javaDigit", "\\p{Nd}"],
  ["javaLetter", "\\p{L}"],
  ["javaLetterOrDigit", "\\p{L}\\p{Nd}"],
]);

/** Translate pattern syntax. `null` when something cannot be reproduced faithfully. */
function translate(source: string, context: TranslateContext): Translation | null {
  let out = "";
  let unicode = false;
  let nonAscii = false;
  let inClass = false;
  let classStart = false; // just after "[" or "[^"
  let i = 0;

  const literal = (codePoint: number): string => {
    if (hasNonAsciiCase(codePoint)) nonAscii = true;
    if (codePoint > 0xffff) {
      unicode = true;
      return `\\u{${codePoint.toString(16)}}`;
    }
    const ch = String.fromCharCode(codePoint);
    if (inClass) return /[\\\]^-]/.test(ch) ? `\\${ch}` : ch;
    return /[\\^$.*+?()[\]{}|/]/.test(ch) ? `\\${ch}` : ch;
  };

  while (i < source.length) {
    const ch = source.charAt(i);
    const code = source.codePointAt(i) ?? 0;

    if (ch === "\\") {
      const next = source.charAt(i + 1);
      if (next === "") return null;
      // \Q…\E: everything quoted literally.
      if (next === "Q") {
        const end = source.indexOf("\\E", i + 2);
        const quoted = source.slice(i + 2, end === -1 ? source.length : end);
        for (const c of quoted) out += literal(c.codePointAt(0) ?? 0);
        i = end === -1 ? source.length : end + 2;
        classStart = false;
        continue;
      }
      const escape = translateEscape(source, i, inClass, context);
      if (escape === null) return null;
      out += escape.text;
      unicode ||= escape.unicode;
      nonAscii ||= escape.nonAscii;
      i = escape.end;
      classStart = false;
      continue;
    }

    if (inClass) {
      if (ch === "[") return null; // Java nested class (union) — no JavaScript equivalent
      if (ch === "&" && source.charAt(i + 1) === "&") return null; // Java intersection
      if (ch === "]" && !classStart) {
        inClass = false;
        out += "]";
        i++;
        continue;
      }
      // A "]" right after "[" is a literal in Java; "-" stays a range operator.
      out += ch === "]" ? "\\]" : code > 0x7f ? literal(code) : ch;
      classStart = false;
      i += code > 0xffff ? 2 : 1;
      continue;
    }

    switch (ch) {
      case "[":
        inClass = true;
        classStart = true;
        out += "[";
        if (source.charAt(i + 1) === "^") {
          out += "^";
          i++;
        }
        i++;
        continue;
      case "(": {
        const rest = source.slice(i);
        if (rest.startsWith("(?")) {
          const group = /^\(\?(:|=|!|<=|<!|<([a-zA-Z][a-zA-Z0-9]*)>)/.exec(rest);
          if (group === null) return null; // (?>…) atomic, (?i:…) scoped flags, (?flags) mid-pattern
          out += group[0];
          i += group[0].length;
          continue;
        }
        out += "(";
        i++;
        continue;
      }
      case ".":
        out += context.dotAll ? "[\\s\\S]" : `[^${LINE_TERMINATORS}]`;
        i++;
        continue;
      case "^":
        out += context.multiline
          ? `(?:(?<![\\s\\S])|(?<=[${LINE_TERMINATORS}])(?=[\\s\\S]))`
          : "(?<![\\s\\S])";
        i++;
        continue;
      case "$":
        out += context.multiline
          ? `(?=[${LINE_TERMINATORS}]|(?![\\s\\S]))`
          : `(?=(?:\\r\\n|[${LINE_TERMINATORS}])?(?![\\s\\S]))`;
        i++;
        continue;
      case "*":
      case "+":
      case "?":
      case "}": {
        if (ch === "}") {
          out += "\\}"; // a "}" that does not close a quantifier is a literal in Java
          i++;
          continue;
        }
        const after = source.charAt(i + 1);
        if (after === "+") return null; // possessive quantifier
        out += ch;
        if (after === "?") {
          out += "?";
          i++;
        }
        i++;
        continue;
      }
      case "{": {
        const quantifier = /^\{\d+(,\d*)?\}/.exec(source.slice(i));
        if (quantifier === null) return null; // Java rejects a "{" that is not a quantifier
        if (source.charAt(i + quantifier[0].length) === "+") return null;
        out += quantifier[0];
        i += quantifier[0].length;
        if (source.charAt(i) === "?") {
          out += "?";
          i++;
        }
        continue;
      }
      case "]":
        out += "\\]";
        i++;
        continue;
      default:
        out += code > 0x7f || code > 0xffff ? literal(code) : ch === "/" ? "\\/" : ch;
        i += code > 0xffff ? 2 : 1;
    }
  }
  if (inClass) return null;
  return { source: out, unicode, nonAscii };
}

interface Escape {
  readonly text: string;
  readonly end: number;
  readonly unicode: boolean;
  readonly nonAscii: boolean;
}

function translateEscape(
  source: string,
  at: number,
  inClass: boolean,
  context: TranslateContext,
): Escape | null {
  const next = source.charAt(at + 1);
  const simple = (
    text: string,
    length = 2,
    flags?: { unicode?: boolean; nonAscii?: boolean },
  ): Escape => ({
    text,
    end: at + length,
    unicode: flags?.unicode ?? false,
    nonAscii: flags?.nonAscii ?? false,
  });
  const codePointEscape = (codePoint: number, length: number): Escape | null => {
    if (codePoint > 0x10ffff) return null;
    if (codePoint > 0xffff) {
      return simple(`\\u{${codePoint.toString(16)}}`, length, {
        unicode: true,
        nonAscii: hasNonAsciiCase(codePoint),
      });
    }
    return simple(`\\u${codePoint.toString(16).padStart(4, "0")}`, length, {
      nonAscii: hasNonAsciiCase(codePoint),
    });
  };

  switch (next) {
    case "d":
    case "D":
    case "w":
    case "W":
    case "t":
    case "n":
    case "r":
    case "f":
      return simple(`\\${next}`);
    case "b":
    case "B":
      return inClass ? null : simple(`\\${next}`);
    case "a":
      return simple("\\x07");
    case "e":
      return simple("\\x1B");
    case "s":
      return simple(inClass ? JAVA_SPACE : `[${JAVA_SPACE}]`);
    case "S":
      // Inside a class there is no negation, so spell out the complement.
      return inClass ? simple(NOT_JAVA_SPACE_BMP) : simple(`[^${JAVA_SPACE}]`);
    case "h":
      return simple(inClass ? JAVA_HSPACE : `[${JAVA_HSPACE}]`);
    case "H":
      return inClass ? null : simple(`[^${JAVA_HSPACE}]`);
    case "v":
      return simple(inClass ? JAVA_VSPACE : `[${JAVA_VSPACE}]`);
    case "V":
      return inClass ? null : simple(`[^${JAVA_VSPACE}]`);
    case "R":
      return inClass ? null : simple(`(?:\\r\\n|[${JAVA_VSPACE}])`);
    case "A":
      return inClass ? null : simple("(?<![\\s\\S])");
    case "z":
      return inClass ? null : simple("(?![\\s\\S])");
    case "Z":
      return inClass ? null : simple(`(?=(?:\\r\\n|[${LINE_TERMINATORS}])?(?![\\s\\S]))`);
    case "c": {
      const letter = source.charAt(at + 2);
      if (!/[A-Za-z]/.test(letter)) return null;
      return simple(`\\c${letter}`, 3);
    }
    case "x": {
      if (source.charAt(at + 2) === "{") {
        const end = source.indexOf("}", at + 3);
        const hex = end === -1 ? "" : source.slice(at + 3, end);
        if (!/^[0-9a-fA-F]+$/.test(hex)) return null;
        return codePointEscape(Number.parseInt(hex, 16), end - at + 1);
      }
      const hex = source.slice(at + 2, at + 4);
      if (!/^[0-9a-fA-F]{2}$/.test(hex)) return null;
      return codePointEscape(Number.parseInt(hex, 16), 4);
    }
    case "u": {
      const hex = source.slice(at + 2, at + 6);
      if (!/^[0-9a-fA-F]{4}$/.test(hex)) return null;
      return codePointEscape(Number.parseInt(hex, 16), 6);
    }
    case "0": {
      // Octal: \0n, \0nn, \0mnn (m <= 3)
      const octal = /^[0-3]?[0-7]{1,2}|^[0-7]/.exec(source.slice(at + 2));
      if (octal === null) return null;
      let digits = octal[0];
      if (digits.length === 3 && Number.parseInt(digits, 8) > 0o377) digits = digits.slice(0, 2);
      return codePointEscape(Number.parseInt(digits, 8), 2 + digits.length);
    }
    case "k": {
      const name = /^k<([a-zA-Z][a-zA-Z0-9]*)>/.exec(source.slice(at + 1));
      return name === null || inClass ? null : simple(`\\k<${name[1]}>`, 1 + name[0].length);
    }
    case "p":
    case "P":
      return translatePropertyEscape(source, at, inClass);
    default:
      break;
  }

  if (/[1-9]/.test(next)) {
    if (inClass) return null;
    // Back reference: Java takes as many digits as still name an existing group.
    let digits = next;
    while (
      /[0-9]/.test(source.charAt(at + 1 + digits.length)) &&
      Number(digits + source.charAt(at + 1 + digits.length)) <= context.groupCount
    ) {
      digits += source.charAt(at + 1 + digits.length);
    }
    if (Number(digits) > context.groupCount) return null; // a reference to a missing group never matches
    // (?:) keeps a following digit from being read as part of the reference.
    return simple(`\\${digits}(?:)`, 1 + digits.length);
  }
  if (/[a-zA-Z]/.test(next)) return null; // \N{…}, \X, \G and unknown escapes
  // Escaped punctuation: a literal.
  const codePoint = source.codePointAt(at + 1) ?? 0;
  const length = codePoint > 0xffff ? 3 : 2;
  if (codePoint > 0x7f) return codePointEscape(codePoint, length);
  const ch = String.fromCharCode(codePoint);
  const special = inClass ? /[\\\]^-]/ : /[\\^$.*+?()[\]{}|/]/;
  return simple(special.test(ch) ? `\\${ch}` : ch === " " ? " " : ch, length);
}

function translatePropertyEscape(source: string, at: number, inClass: boolean): Escape | null {
  const negated = source.charAt(at + 1) === "P";
  let name: string;
  let end: number;
  if (source.charAt(at + 2) === "{") {
    const close = source.indexOf("}", at + 3);
    if (close === -1) return null;
    name = source.slice(at + 3, close);
    end = close + 1;
  } else {
    name = source.charAt(at + 2);
    if (!/[A-Za-z]/.test(name)) return null;
    end = at + 3;
  }
  const javaClass = JAVA_CLASSES.get(name);
  if (javaClass !== undefined) {
    const usesProperty = javaClass.includes("\\p{");
    if (negated) {
      if (inClass) return null;
      return { text: `[^${javaClass}]`, end, unicode: usesProperty, nonAscii: usesProperty };
    }
    return {
      text: inClass ? javaClass : `[${javaClass}]`,
      end,
      unicode: usesProperty,
      nonAscii: usesProperty,
    };
  }
  const js = javaPropertyName(name);
  if (js === null) return null;
  return { text: `${negated ? "\\P" : "\\p"}{${js}}`, end, unicode: true, nonAscii: true };
}

/**
 * Java property names JavaScript understands: general categories (L, Lu, …, also as IsL),
 * scripts (IsLatin, script=Latin), binary properties (IsAlphabetic). Bare long names such as
 * \p{Letter} or \p{Alphabetic} are rejected by Java, and so here.
 */
function javaPropertyName(name: string): string | null {
  if (/^[A-Z][a-z]?$/.test(name)) return isValidProperty(name) ? name : null; // category: L, Lu
  if (name.startsWith("In") || /^(block|blk)=/i.test(name)) return null; // blocks
  if (name.startsWith("Is")) {
    const bare = name.slice(2);
    if (/^[A-Z][a-z]?$/.test(bare) && isValidProperty(bare)) return bare;
    if (isValidProperty(`Script=${bare}`)) return `Script=${bare}`;
    if (/^[A-Z][A-Za-z_]+$/.test(bare) && isValidProperty(bare) && !/^[A-Z][a-z]?$/.test(bare)) {
      return bare; // binary property, e.g. IsAlphabetic, IsWhite_Space
    }
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

function isValidProperty(name: string): boolean {
  try {
    // eslint-disable-next-line security/detect-non-literal-regexp -- probing a property name
    new RegExp(`\\p{${name}}`, "u");
    return true;
  } catch {
    return false;
  }
}

/** Whether a non-ASCII code point has case (so JavaScript's "i" would fold it, Java's would not). */
function hasNonAsciiCase(codePoint: number): boolean {
  if (codePoint <= 0x7f) return false;
  const ch = String.fromCodePoint(codePoint);
  return ch.toLowerCase() !== ch.toUpperCase();
}

/** Number of capturing groups, for resolving back references. */
function countGroups(source: string): number {
  let count = 0;
  let inClass = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source.charAt(i);
    if (ch === "\\") {
      if (source.charAt(i + 1) === "Q") {
        const end = source.indexOf("\\E", i + 2);
        i = end === -1 ? source.length : end + 1;
      } else {
        i++;
      }
    } else if (inClass) {
      if (ch === "]") inClass = false;
    } else if (ch === "[") {
      inClass = true;
      if (source.charAt(i + 1) === "]") i++;
    } else if (
      ch === "(" &&
      (source.charAt(i + 1) !== "?" || /^\(\?<[a-zA-Z]/.test(source.slice(i)))
    ) {
      count++;
    }
  }
  return count;
}
