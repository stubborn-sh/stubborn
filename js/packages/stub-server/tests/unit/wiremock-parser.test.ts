import { describe, it, expect } from "vitest";
import { parseWireMockMapping } from "../../src/wiremock-parser.js";

describe("parseWireMockMapping", () => {
  it("should_parse_simple_GET_mapping", () => {
    const json = JSON.stringify({
      request: {
        urlPath: "/api/orders/1",
        method: "GET",
      },
      response: {
        status: 200,
        body: '{"id":"1","product":"MacBook Pro","amount":1299.99}',
        headers: {
          "Content-Type": "application/json",
        },
      },
    });

    const contract = parseWireMockMapping("shouldReturnOrder.json", json);

    expect(contract.name).toBe("shouldReturnOrder.json");
    expect(contract.request.method).toBe("GET");
    expect(contract.request.urlPath).toBe("/api/orders/1");
    expect(contract.response.status).toBe(200);
    expect(contract.response.body).toEqual({ id: "1", product: "MacBook Pro", amount: 1299.99 });
    expect(contract.response.headers?.["Content-Type"]).toBe("application/json");
  });

  it("should_parse_POST_with_request_headers_and_body", () => {
    const json = JSON.stringify({
      request: {
        urlPath: "/api/orders",
        method: "POST",
        headers: {
          "Content-Type": { equalTo: "application/json" },
        },
        bodyPatterns: [
          {
            equalToJson: '{"product":"iPhone 16","amount":999.99}',
          },
        ],
      },
      response: {
        status: 201,
        body: '{"product":"iPhone 16","amount":999.99,"status":"CREATED"}',
        headers: {
          "Content-Type": "application/json",
          Location: "/api/orders/42",
        },
      },
    });

    const contract = parseWireMockMapping("shouldCreateOrder.json", json);

    expect(contract.request.method).toBe("POST");
    expect(contract.request.headers?.["Content-Type"]).toBe("application/json");
    expect(contract.request.body).toEqual({ product: "iPhone 16", amount: 999.99 });
    expect(contract.response.status).toBe(201);
    expect(contract.response.headers?.Location).toBe("/api/orders/42");
  });

  it("should_parse_mapping_with_jsonBody_response", () => {
    const json = JSON.stringify({
      request: { method: "GET", urlPath: "/api/status" },
      response: {
        status: 200,
        jsonBody: { status: "UP", version: "1.0.0" },
      },
    });

    const contract = parseWireMockMapping("health.json", json);

    expect(contract.response.body).toEqual({ status: "UP", version: "1.0.0" });
  });

  it("should_prefer_jsonBody_over_body_string", () => {
    const json = JSON.stringify({
      request: { method: "GET", urlPath: "/api" },
      response: {
        status: 200,
        body: '{"old":"value"}',
        jsonBody: { new: "value" },
      },
    });

    const contract = parseWireMockMapping("test.json", json);

    expect(contract.response.body).toEqual({ new: "value" });
  });

  it("should_filter_out_csrf_query_parameters", () => {
    const json = JSON.stringify({
      request: {
        urlPath: "/api/orders",
        method: "POST",
        queryParameters: {
          _csrf: { equalTo: "random-token-value" },
          status: { equalTo: "PENDING" },
        },
      },
      response: { status: 200 },
    });

    const contract = parseWireMockMapping("test.json", json);

    expect(contract.request.queryParameters).toEqual({ status: "PENDING" });
  });

  it("should_omit_query_parameters_when_only_csrf_present", () => {
    const json = JSON.stringify({
      request: {
        urlPath: "/api/orders",
        method: "POST",
        queryParameters: {
          _csrf: { equalTo: "some-token" },
        },
      },
      response: { status: 200 },
    });

    const contract = parseWireMockMapping("test.json", json);

    expect(contract.request.queryParameters).toBeUndefined();
  });

  it("should_extract_real_query_parameters", () => {
    const json = JSON.stringify({
      request: {
        urlPath: "/api/search",
        method: "GET",
        queryParameters: {
          q: { equalTo: "spring" },
          page: { equalTo: "0" },
        },
      },
      response: { status: 200 },
    });

    const contract = parseWireMockMapping("test.json", json);

    expect(contract.request.queryParameters).toEqual({ q: "spring", page: "0" });
  });

  it("should_skip_matchesJsonPath_body_patterns", () => {
    const json = JSON.stringify({
      request: {
        urlPath: "/api/orders",
        method: "POST",
        bodyPatterns: [
          { matchesJsonPath: "$[?(@.['product'] == 'iPhone 16')]" },
          { matchesJsonPath: "$[?(@.['amount'] == 999.99)]" },
        ],
      },
      response: { status: 201 },
    });

    const contract = parseWireMockMapping("test.json", json);

    // matchesJsonPath patterns don't provide the full body, so body should be undefined
    expect(contract.request.body).toBeUndefined();
  });

  it("should_handle_non_json_response_body", () => {
    const json = JSON.stringify({
      request: { method: "GET", urlPath: "/health" },
      response: {
        status: 200,
        body: "OK",
      },
    });

    const contract = parseWireMockMapping("test.json", json);

    expect(contract.response.body).toBe("OK");
  });

  it("should_normalize_method_to_uppercase", () => {
    const json = JSON.stringify({
      request: { method: "post", urlPath: "/api" },
      response: { status: 201 },
    });

    const contract = parseWireMockMapping("test.json", json);

    expect(contract.request.method).toBe("POST");
  });

  it("should_default_status_to_200", () => {
    const json = JSON.stringify({
      request: { method: "GET", urlPath: "/api" },
      response: {},
    });

    const contract = parseWireMockMapping("test.json", json);

    expect(contract.response.status).toBe(200);
  });

  it("should_handle_url_instead_of_urlPath", () => {
    const json = JSON.stringify({
      request: { method: "GET", url: "/api/orders?status=PENDING" },
      response: { status: 200 },
    });

    const contract = parseWireMockMapping("test.json", json);

    expect(contract.request.url).toBe("/api/orders?status=PENDING");
    expect(contract.request.urlPath).toBeUndefined();
  });

  it("should_handle_urlPathPattern_as_urlPath", () => {
    const json = JSON.stringify({
      request: { method: "GET", urlPathPattern: "/api/orders/[0-9]+" },
      response: { status: 200 },
    });

    const contract = parseWireMockMapping("test.json", json);

    expect(contract.request.urlPath).toBe("/api/orders/[0-9]+");
  });

  it("should_ignore_wiremock_metadata_fields", () => {
    const json = JSON.stringify({
      id: "ad721f19-0fc6-4856-a576-511400ce9156",
      uuid: "ad721f19-0fc6-4856-a576-511400ce9156",
      request: { method: "GET", urlPath: "/api" },
      response: {
        status: 200,
        transformers: ["response-template", "spring-cloud-contract"],
      },
    });

    const contract = parseWireMockMapping("test.json", json);

    expect(contract.request.method).toBe("GET");
    expect(contract.response.status).toBe(200);
  });

  it("should_only_extract_equalTo_header_matchers", () => {
    const json = JSON.stringify({
      request: {
        method: "GET",
        urlPath: "/api",
        headers: {
          Accept: { equalTo: "application/json" },
          "X-Custom": { contains: "partial" },
          "X-Regex": { matches: ".*" },
        },
      },
      response: { status: 200 },
    });

    const contract = parseWireMockMapping("test.json", json);

    // Only equalTo matchers are extracted; contains/matches are skipped
    expect(contract.request.headers).toEqual({ Accept: "application/json" });
  });

  // --- New gap-fix tests: delay, priority, bodyFileName ---

  it("should_extract_fixedDelayMilliseconds", () => {
    const json = JSON.stringify({
      request: { method: "GET", urlPath: "/api/slow" },
      response: {
        status: 200,
        body: '"ok"',
        fixedDelayMilliseconds: 2000,
      },
    });

    const contract = parseWireMockMapping("slow.json", json);

    expect(contract.response.delayMs).toBe(2000);
  });

  it("should_omit_delayMs_when_not_specified", () => {
    const json = JSON.stringify({
      request: { method: "GET", urlPath: "/api/fast" },
      response: { status: 200 },
    });

    const contract = parseWireMockMapping("fast.json", json);

    expect(contract.response.delayMs).toBeUndefined();
  });

  it("should_extract_priority", () => {
    const json = JSON.stringify({
      priority: 1,
      request: { method: "GET", urlPath: "/api/priority" },
      response: { status: 200 },
    });

    const contract = parseWireMockMapping("priority.json", json);

    expect(contract.priority).toBe(1);
  });

  it("should_omit_priority_when_not_specified", () => {
    const json = JSON.stringify({
      request: { method: "GET", urlPath: "/api" },
      response: { status: 200 },
    });

    const contract = parseWireMockMapping("test.json", json);

    expect(contract.priority).toBeUndefined();
  });

  it("should_handle_bodyFileName_as_placeholder", () => {
    const json = JSON.stringify({
      request: { method: "GET", urlPath: "/api/file" },
      response: {
        status: 200,
        bodyFileName: "responses/large-payload.json",
      },
    });

    const contract = parseWireMockMapping("test.json", json);

    expect(contract.response.body).toBe("[bodyFileName: responses/large-payload.json]");
  });

  it("should_prefer_jsonBody_over_bodyFileName", () => {
    const json = JSON.stringify({
      request: { method: "GET", urlPath: "/api" },
      response: {
        status: 200,
        jsonBody: { inline: true },
        bodyFileName: "responses/fallback.json",
      },
    });

    const contract = parseWireMockMapping("test.json", json);

    expect(contract.response.body).toEqual({ inline: true });
  });

  // Error cases

  it("should_throw_on_invalid_json", () => {
    expect(() => parseWireMockMapping("bad.json", "{invalid")).toThrow(
      "Failed to parse WireMock JSON",
    );
  });

  it("should_throw_on_non_object", () => {
    expect(() => parseWireMockMapping("bad.json", '"just a string"')).toThrow("not a valid object");
  });

  it("should_throw_when_request_is_missing", () => {
    expect(() => parseWireMockMapping("bad.json", '{"response":{"status":200}}')).toThrow(
      'missing required "request"',
    );
  });

  it("should_throw_when_response_is_missing", () => {
    expect(() =>
      parseWireMockMapping("bad.json", '{"request":{"method":"GET","urlPath":"/api"}}'),
    ).toThrow('missing required "response"');
  });

  it("should_throw_when_method_is_missing", () => {
    expect(() =>
      parseWireMockMapping("bad.json", '{"request":{"urlPath":"/api"},"response":{"status":200}}'),
    ).toThrow('missing "method"');
  });

  it("should_throw_when_url_and_urlPath_are_missing", () => {
    expect(() =>
      parseWireMockMapping("bad.json", '{"request":{"method":"GET"},"response":{"status":200}}'),
    ).toThrow('must have "url" or "urlPath"');
  });
});
