import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { javaRegex } from "../../src/java-regex.js";

interface RegexCase {
  readonly pattern: string;
  readonly input: string;
  readonly dotAll: boolean;
  readonly mode: "full" | "find";
  /** java.util.regex's answer; "invalid" when Java rejects the pattern. */
  readonly java: boolean | "invalid";
}

const { cases } = JSON.parse(
  readFileSync(new URL("../fixtures/java-regex-verdicts.json", import.meta.url), "utf8"),
) as { cases: readonly RegexCase[] };

describe("Java regex translation parity with java.util.regex", () => {
  // Either the same answer as Java, or null: a construct JavaScript cannot reproduce is reported
  // as unsupported (the stub never matches) — never a different answer.
  it.each(cases)(
    "$pattern ~ $input (dotAll $dotAll, $mode)",
    ({ pattern, input, dotAll, mode, java }) => {
      const regex = javaRegex(pattern, { mode, dotAll });
      if (regex === null) {
        expect(
          java === "invalid" || UNSUPPORTED.some((u) => u.test(pattern)),
          "unexpectedly unsupported",
        ).toBe(true);
        return;
      }
      expect(java).not.toBe("invalid");
      expect(regex.test(input)).toBe(java);
    },
  );
});

/** Java-valid constructs deliberately reported as unsupported. */
const UNSUPPORTED: readonly RegExp[] = [
  /\[[^\]]*\[/, // nested class (union)
  /&&/, // class intersection
  /\(\?[a-z]*x/, // comments mode
  /\(\?[a-z]*d/, // UNIX_LINES
  /\(\?>/, // atomic group
  /[*+?}]\+/, // possessive quantifier
  /.\(\?[a-z-]+[):]/, // flags after the start of the pattern
  /\\p\{In/, // Unicode blocks
  /\\\d/, // back reference to a missing group
  /^(\(\?[a-z]+\))*\(\?i\)/, // (?i) without (?u) on non-ASCII text
  /\\w-/, // a class escape as a range endpoint
];
