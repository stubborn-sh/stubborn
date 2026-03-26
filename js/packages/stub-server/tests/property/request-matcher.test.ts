import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { matchRequest } from "../../src/request-matcher.js";
import type { ParsedContract } from "../../src/contract-parser.js";

describe("request-matcher property tests", () => {
  it("should_be_deterministic", () => {
    const contract: ParsedContract = {
      name: "test",
      request: { method: "GET", urlPath: "/api/test" },
      response: { status: 200 },
    };

    fc.assert(
      fc.property(
        fc.constantFrom("GET", "POST", "PUT", "DELETE"),
        fc.string().map((s) => `/api/${s}`),
        (method, url) => {
          const r1 = matchRequest(method, url, {}, undefined, [contract]);
          const r2 = matchRequest(method, url, {}, undefined, [contract]);
          expect(r1.matched).toBe(r2.matched);
        },
      ),
    );
  });

  it("should_never_match_wrong_method", () => {
    fc.assert(
      fc.property(fc.constantFrom("POST", "PUT", "DELETE", "PATCH"), (method) => {
        const contract: ParsedContract = {
          name: "test",
          request: { method: "GET", urlPath: "/api/test" },
          response: { status: 200 },
        };
        const result = matchRequest(method, "/api/test", {}, undefined, [contract]);
        expect(result.matched).toBe(false);
      }),
    );
  });

  it("should_return_false_for_empty_contracts", () => {
    fc.assert(
      fc.property(fc.constantFrom("GET", "POST"), fc.string(), (method, url) => {
        const result = matchRequest(method, url, {}, undefined, []);
        expect(result.matched).toBe(false);
        expect(result.contract).toBeNull();
      }),
    );
  });
});
