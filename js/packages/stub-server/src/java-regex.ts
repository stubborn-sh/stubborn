/** Options for {@link javaFullMatchRegex}. */
export interface JavaRegexOptions {
  /** `Pattern.DOTALL`: WireMock always sets it; Jayway's `=~` does not. Default `true`. */
  readonly dotAll?: boolean;
  /** Extra JavaScript flags (`i`, `m`, `s`) from the caller, e.g. Jayway's `/re/i`. */
  readonly flags?: string;
}

/** Java's POSIX and java.lang.Character classes, which JavaScript has no names for. */
const JAVA_CLASSES: Readonly<Record<string, string>> = {
  Lower: "a-z",
  Upper: "A-Z",
  ASCII: "\\x00-\\x7F",
  Alpha: "a-zA-Z",
  Digit: "0-9",
  Alnum: "a-zA-Z0-9",
  Punct: "!-\\/:-@\\[-`{-~",
  Graph: "!-~",
  Print: " -~",
  Blank: " \\t",
  Cntrl: "\\x00-\\x1F\\x7F",
  XDigit: "0-9a-fA-F",
  Space: " \\t\\n\\x0B\\f\\r",
  javaLowerCase: "\\p{Lowercase}",
  javaUpperCase: "\\p{Uppercase}",
  javaWhitespace: "\\p{White_Space}",
  javaAlphabetic: "\\p{Alphabetic}",
  javaDigit: "\\p{Nd}",
  javaLetter: "\\p{L}",
  javaLetterOrDigit: "\\p{L}\\p{Nd}",
};

/**
 * Compile a Java regex for a whole-value match (`Matcher.matches()`). Leading inline flags such
 * as `(?i)` or `(?is)`, which JavaScript does not accept, become JavaScript flags; Unicode
 * property classes (`\p{L}`, `\p{IsLatin}`, `\p{Alpha}`…) are translated and compiled in Unicode
 * mode. Returns `null` when the regex cannot be reproduced faithfully in JavaScript.
 */
export function javaFullMatchRegex(pattern: string, options?: JavaRegexOptions): RegExp | null {
  let source = pattern;
  const flags = new Set<string>(options?.flags ?? "");
  if (options?.dotAll !== false) flags.add("s");
  const inline = /^\(\?([imsux]+)\)/.exec(source);
  if (inline !== null) {
    for (const flag of inline[1] ?? "") {
      if (flag === "x") return null; // comments mode has no JavaScript equivalent
      if (flag === "i" || flag === "m" || flag === "s") flags.add(flag);
    }
    source = source.slice(inline[0].length);
  }

  if (/\\[pP]/.test(source)) {
    // Without the "u" flag, JavaScript reads \p{L} as the literal characters "p{L}".
    const translated = translatePropertyClasses(source);
    if (translated === null) return null;
    return compile(translated, [...flags, "u"].join(""));
  }
  return compile(source, [...flags].join(""));
}

function compile(source: string, flags: string): RegExp | null {
  try {
    return new RegExp(`^(?:${source})$`, flags);
  } catch {
    return null;
  }
}

/** Rewrite Java-only `\p{…}` names to Unicode-mode JavaScript; `null` when one is unknown. */
function translatePropertyClasses(source: string): string | null {
  let failed = false;
  let inClass = 0;
  let result = "";
  for (let i = 0; i < source.length; i++) {
    const ch = source.charAt(i);
    if (ch === "\\") {
      const next = source.charAt(i + 1);
      if ((next === "p" || next === "P") && source.charAt(i + 2) === "{") {
        const end = source.indexOf("}", i + 3);
        if (end === -1) return null;
        const name = source.slice(i + 3, end);
        const replacement = propertyClass(name, next === "P", inClass > 0);
        if (replacement === null) failed = true;
        result += replacement ?? "";
        i = end;
        continue;
      }
      if ((next === "p" || next === "P") && /[A-Za-z]/.test(source.charAt(i + 2))) {
        // Single-letter form: \pL
        result += `\\${next}{${source.charAt(i + 2)}}`;
        i += 2;
        continue;
      }
      result += ch + next;
      i++;
      continue;
    }
    if (ch === "[") inClass++;
    if (ch === "]" && inClass > 0) inClass--;
    result += ch;
  }
  return failed ? null : result;
}

function propertyClass(name: string, negated: boolean, insideClass: boolean): string | null {
  const javaClass = JAVA_CLASSES[name];
  if (javaClass !== undefined) {
    if (negated) return insideClass ? null : `[^${javaClass}]`;
    return insideClass ? javaClass : `[${javaClass}]`;
  }
  const escape = negated ? "\\P" : "\\p";
  let js = name;
  if (name.startsWith("Is")) {
    // \p{IsLatin} (script), \p{IsAlphabetic} (binary property), \p{IsL} (category)
    const bare = name.slice(2);
    js = isValidProperty(bare) ? bare : `Script=${bare}`;
  } else if (name.startsWith("In")) {
    return null; // Unicode blocks have no JavaScript equivalent
  } else if (/^(script|sc|block|blk|general_category|gc)=/i.test(name)) {
    if (/^(block|blk)=/i.test(name)) return null;
    js = name
      .replace(/^(script|sc)=/i, "Script=")
      .replace(/^(general_category|gc)=/i, "General_Category=");
  }
  return isValidProperty(js) ? `${escape}{${js}}` : null;
}

function isValidProperty(name: string): boolean {
  try {
    new RegExp(`\\p{${name}}`, "u");
    return true;
  } catch {
    return false;
  }
}
