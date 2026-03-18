import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { resolveConfig, buildAuthHeader } from "../../src/config.js";

describe("config property tests", () => {
  it("should_always_strip_trailing_slashes", () => {
    fc.assert(
      fc.property(fc.webUrl(), fc.nat({ max: 5 }), (url, slashCount) => {
        const urlWithSlashes = url + "/".repeat(slashCount);
        const config = resolveConfig({ baseUrl: urlWithSlashes });
        expect(config.baseUrl).not.toMatch(/\/$/);
      }),
    );
  });

  it("should_always_return_positive_page_size", () => {
    fc.assert(
      fc.property(fc.option(fc.nat({ max: 10000 }), { nil: undefined }), (pageSize) => {
        const config = resolveConfig({
          baseUrl: "http://localhost",
          defaultPageSize: pageSize,
        });
        expect(config.defaultPageSize).toBeGreaterThan(0);
      }),
    );
  });

  it("should_return_bearer_when_token_is_non_empty", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (token) => {
        const header = buildAuthHeader({ baseUrl: "http://x", token });
        expect(header).toBe(`Bearer ${token}`);
      }),
    );
  });

  it("should_return_basic_when_username_is_non_empty_and_no_token", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), fc.string(), (username, password) => {
        const header = buildAuthHeader({ baseUrl: "http://x", username, password });
        expect(header).toMatch(/^Basic /);
        const base64 = header?.replace("Basic ", "") ?? "";
        const decoded = Buffer.from(base64, "base64").toString("utf-8");
        expect(decoded).toBe(`${username}:${password}`);
      }),
    );
  });
});
