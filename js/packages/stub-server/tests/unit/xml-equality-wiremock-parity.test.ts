import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { compileXmlEquality } from "../../src/xml-matcher.js";

interface EqualityCase {
  readonly expected: string;
  readonly actual: string;
  readonly enablePlaceholders: boolean;
  readonly ignoreOrderOfSameNode: boolean;
  /** WireMock's EqualToXmlPattern verdict. */
  readonly wiremock: boolean;
}

const { cases } = JSON.parse(
  readFileSync(new URL("../fixtures/wiremock-xml-equality-verdicts.json", import.meta.url), "utf8"),
) as { cases: readonly EqualityCase[] };

describe("equalToXml parity with WireMock 3.13.2 on generated documents", () => {
  it.each(cases)(
    "$expected vs $actual (placeholders $enablePlaceholders, ignoreOrder $ignoreOrderOfSameNode)",
    ({ expected, actual, enablePlaceholders, ignoreOrderOfSameNode, wiremock }) => {
      const matcher = compileXmlEquality(expected, {
        enablePlaceholders,
        placeholderOpeningDelimiterRegex: "\\$\\{",
        placeholderClosingDelimiterRegex: "\\}",
        ignoreOrderOfSameNode,
      });
      expect(typeof matcher, JSON.stringify(matcher)).toBe("function");
      if (typeof matcher === "function") expect(matcher(actual)).toBe(wiremock);
    },
  );
});
