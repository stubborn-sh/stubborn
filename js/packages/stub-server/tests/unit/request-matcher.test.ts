import { describe, it, expect } from "vitest";
import { matchRequest } from "../../src/request-matcher.js";
import type { ParsedContract } from "../../src/contract-parser.js";

function contract(overrides: Partial<ParsedContract["request"]> = {}): ParsedContract {
  return {
    name: "test",
    request: {
      method: "GET",
      urlPath: "/api/test",
      ...overrides,
    },
    response: { status: 200 },
  };
}

describe("matchRequest", () => {
  it("should_match_by_method_and_urlPath", () => {
    const result = matchRequest("GET", "/api/test", {}, undefined, [contract()]);
    expect(result.matched).toBe(true);
  });

  it("should_not_match_wrong_method", () => {
    const result = matchRequest("POST", "/api/test", {}, undefined, [contract()]);
    expect(result.matched).toBe(false);
  });

  it("should_not_match_wrong_url", () => {
    const result = matchRequest("GET", "/api/other", {}, undefined, [contract()]);
    expect(result.matched).toBe(false);
  });

  it("should_match_by_url_field", () => {
    const c = contract({ url: "/api/test", urlPath: undefined });
    const result = matchRequest("GET", "/api/test", {}, undefined, [c]);
    expect(result.matched).toBe(true);
  });

  it("should_match_case_insensitive_method", () => {
    const result = matchRequest("get", "/api/test", {}, undefined, [contract()]);
    expect(result.matched).toBe(true);
  });

  it("should_match_headers", () => {
    const c = contract({ headers: { "Content-Type": "application/json" } });
    const result = matchRequest(
      "GET",
      "/api/test",
      { "Content-Type": "application/json" },
      undefined,
      [c],
    );
    expect(result.matched).toBe(true);
  });

  it("should_not_match_when_required_header_is_missing", () => {
    const c = contract({ headers: { "X-Custom": "value" } });
    const result = matchRequest("GET", "/api/test", {}, undefined, [c]);
    expect(result.matched).toBe(false);
  });

  it("should_match_headers_case_insensitively", () => {
    const c = contract({ headers: { "content-type": "application/json" } });
    const result = matchRequest(
      "GET",
      "/api/test",
      { "Content-Type": "application/json" },
      undefined,
      [c],
    );
    expect(result.matched).toBe(true);
  });

  it("should_match_body", () => {
    const c = contract({
      method: "POST",
      body: { name: "test" },
    });
    const result = matchRequest("POST", "/api/test", {}, { name: "test" }, [c]);
    expect(result.matched).toBe(true);
  });

  it("should_not_match_different_body", () => {
    const c = contract({
      method: "POST",
      body: { name: "test" },
    });
    const result = matchRequest("POST", "/api/test", {}, { name: "other" }, [c]);
    expect(result.matched).toBe(false);
  });

  it("should_match_query_parameters", () => {
    const c = contract({
      urlPath: "/api/search",
      queryParameters: { q: "hello" },
    });
    const result = matchRequest("GET", "/api/search?q=hello", {}, undefined, [c]);
    expect(result.matched).toBe(true);
  });

  it("should_not_match_missing_query_parameter", () => {
    const c = contract({
      urlPath: "/api/search",
      queryParameters: { q: "hello" },
    });
    const result = matchRequest("GET", "/api/search", {}, undefined, [c]);
    expect(result.matched).toBe(false);
  });

  it("should_return_first_matching_contract", () => {
    const c1 = contract({ urlPath: "/api/a" });
    const c2 = contract({ urlPath: "/api/b" });
    const result = matchRequest("GET", "/api/b", {}, undefined, [c1, c2]);
    expect(result.matched).toBe(true);
    expect(result.contract?.request.urlPath).toBe("/api/b");
  });

  it("should_return_null_when_no_contracts_match", () => {
    const result = matchRequest("GET", "/api/none", {}, undefined, [contract()]);
    expect(result.matched).toBe(false);
    expect(result.contract).toBeNull();
  });

  it("should_handle_empty_contract_list", () => {
    const result = matchRequest("GET", "/api/test", {}, undefined, []);
    expect(result.matched).toBe(false);
  });

  // --- Regex URL pattern matching (Java SCC parity) ---

  it("should_match_urlPath_with_regex_pattern", () => {
    const c = contract({ urlPath: "/api/orders/[0-9]+" });
    const result = matchRequest("GET", "/api/orders/42", {}, undefined, [c]);
    expect(result.matched).toBe(true);
  });

  it("should_not_match_urlPath_regex_with_non_matching_value", () => {
    const c = contract({ urlPath: "/api/orders/[0-9]+" });
    const result = matchRequest("GET", "/api/orders/abc", {}, undefined, [c]);
    expect(result.matched).toBe(false);
  });

  it("should_match_url_with_regex_pattern", () => {
    const c = contract({ url: "/api/users/[a-z]+", urlPath: undefined });
    const result = matchRequest("GET", "/api/users/john", {}, undefined, [c]);
    expect(result.matched).toBe(true);
  });

  // --- Trailing slash normalization ---

  it("should_match_with_trailing_slash_in_request", () => {
    const c = contract({ urlPath: "/api/orders" });
    const result = matchRequest("GET", "/api/orders/", {}, undefined, [c]);
    expect(result.matched).toBe(true);
  });

  it("should_match_with_trailing_slash_in_contract", () => {
    const c = contract({ urlPath: "/api/orders/" });
    const result = matchRequest("GET", "/api/orders", {}, undefined, [c]);
    expect(result.matched).toBe(true);
  });

  it("should_match_root_path", () => {
    const c = contract({ urlPath: "/" });
    const result = matchRequest("GET", "/", {}, undefined, [c]);
    expect(result.matched).toBe(true);
  });

  // --- URL-encoded characters ---

  it("should_match_url_encoded_path", () => {
    const c = contract({ urlPath: "/api/products/mac book" });
    const result = matchRequest("GET", "/api/products/mac%20book", {}, undefined, [c]);
    expect(result.matched).toBe(true);
  });

  // --- Query parameter order independence ---

  it("should_match_query_parameters_regardless_of_order", () => {
    const c = contract({
      urlPath: "/api/search",
      queryParameters: { q: "test", page: "1" },
    });
    const result = matchRequest("GET", "/api/search?page=1&q=test", {}, undefined, [c]);
    expect(result.matched).toBe(true);
  });

  it("should_match_when_request_has_extra_query_params", () => {
    const c = contract({
      urlPath: "/api/search",
      queryParameters: { q: "test" },
    });
    const result = matchRequest("GET", "/api/search?q=test&extra=ignored", {}, undefined, [c]);
    expect(result.matched).toBe(true);
  });

  // --- Header Content-Type with charset ---

  it("should_match_header_with_charset_suffix", () => {
    const c = contract({ headers: { "Content-Type": "application/json" } });
    const result = matchRequest(
      "GET",
      "/api/test",
      { "Content-Type": "application/json;charset=UTF-8" },
      undefined,
      [c],
    );
    expect(result.matched).toBe(true);
  });

  // --- URL field with query string ---

  it("should_match_url_field_with_embedded_query_string", () => {
    const c = contract({ url: "/api/orders?status=PENDING", urlPath: undefined });
    const result = matchRequest("GET", "/api/orders?status=PENDING", {}, undefined, [c]);
    expect(result.matched).toBe(true);
  });

  it("should_not_match_url_with_wrong_query_string", () => {
    const c = contract({ url: "/api/orders?status=PENDING", urlPath: undefined });
    const result = matchRequest("GET", "/api/orders?status=SHIPPED", {}, undefined, [c]);
    expect(result.matched).toBe(false);
  });

  // --- Null body handling ---

  it("should_match_when_contract_body_is_null_value", () => {
    const c = contract({ method: "POST", body: { field: null } });
    const result = matchRequest("POST", "/api/test", {}, { field: null }, [c]);
    expect(result.matched).toBe(true);
  });

  it("should_not_match_null_body_against_undefined", () => {
    const c = contract({ method: "POST", body: { field: null } });
    const result = matchRequest("POST", "/api/test", {}, { field: undefined }, [c]);
    expect(result.matched).toBe(false);
  });
});
