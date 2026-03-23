import { describe, it, expect } from "vitest";
import { contractToWireMock } from "../../src/contract-to-wiremock.js";
import type { ScannedContract } from "@stubborn-sh/publisher";

function makeContract(name: string, yamlContent: string): ScannedContract {
  return { contractName: name, content: yamlContent, contentType: "application/x-yaml" };
}

describe("contractToWireMock", () => {
  it("should_convert_simple_get_contract", () => {
    const yaml = [
      "request:",
      "  method: GET",
      "  urlPath: /api/orders/1",
      "response:",
      "  status: 200",
      "  headers:",
      "    Content-Type: application/json",
      "  body:",
      '    id: "1"',
      '    product: "Laptop"',
      "    amount: 999.99",
    ].join("\n");

    const result = JSON.parse(contractToWireMock(makeContract("get-order.yaml", yaml)));

    expect(result.request.method).toBe("GET");
    expect(result.request.urlPath).toBe("/api/orders/1");
    expect(result.response.status).toBe(200);
    expect(result.response.headers["Content-Type"]).toBe("application/json");
    expect(result.response.jsonBody.id).toBe("1");
    expect(result.response.jsonBody.product).toBe("Laptop");
    expect(result.response.jsonBody.amount).toBe(999.99);
  });

  it("should_convert_post_contract_with_request_body", () => {
    const yaml = [
      "request:",
      "  method: POST",
      "  urlPath: /api/orders",
      "  headers:",
      "    Content-Type: application/json",
      "  body:",
      '    product: "iPhone"',
      "    amount: 799",
      "response:",
      "  status: 201",
      "  body:",
      '    id: "42"',
      '    product: "iPhone"',
      "    amount: 799",
      '    status: "CREATED"',
    ].join("\n");

    const result = JSON.parse(contractToWireMock(makeContract("create-order.yaml", yaml)));

    expect(result.request.method).toBe("POST");
    expect(result.request.urlPath).toBe("/api/orders");
    expect(result.request.headers["Content-Type"]).toEqual({ equalTo: "application/json" });
    expect(result.request.bodyPatterns).toHaveLength(1);
    expect(JSON.parse(result.request.bodyPatterns[0].equalToJson)).toEqual({
      product: "iPhone",
      amount: 799,
    });
    expect(result.response.status).toBe(201);
    expect(result.response.jsonBody.id).toBe("42");
  });

  it("should_convert_contract_with_query_parameters", () => {
    const yaml = [
      "request:",
      "  method: GET",
      "  urlPath: /api/orders",
      "  queryParameters:",
      "    status: PENDING",
      "    page: '0'",
      "response:",
      "  status: 200",
    ].join("\n");

    const result = JSON.parse(contractToWireMock(makeContract("query.yaml", yaml)));

    expect(result.request.queryParameters.status).toEqual({ equalTo: "PENDING" });
    expect(result.request.queryParameters.page).toEqual({ equalTo: "0" });
  });

  it("should_convert_contract_with_url_instead_of_urlPath", () => {
    const yaml = [
      "request:",
      "  method: GET",
      "  url: /api/orders?status=PENDING",
      "response:",
      "  status: 200",
    ].join("\n");

    const result = JSON.parse(contractToWireMock(makeContract("url.yaml", yaml)));

    expect(result.request.url).toBe("/api/orders?status=PENDING");
    expect(result.request.urlPath).toBeUndefined();
  });

  it("should_convert_contract_with_string_body_response", () => {
    const yaml = [
      "request:",
      "  method: GET",
      "  urlPath: /api/health",
      "response:",
      "  status: 200",
      "  body: OK",
    ].join("\n");

    const result = JSON.parse(contractToWireMock(makeContract("health.yaml", yaml)));

    expect(result.response.body).toBe("OK");
    expect(result.response.jsonBody).toBeUndefined();
  });

  it("should_include_priority_when_present", () => {
    const yaml = [
      "priority: 5",
      "request:",
      "  method: GET",
      "  urlPath: /api/test",
      "response:",
      "  status: 200",
    ].join("\n");

    const result = JSON.parse(contractToWireMock(makeContract("priority.yaml", yaml)));

    expect(result.priority).toBe(5);
  });

  it("should_default_response_status_to_200", () => {
    const yaml = ["request:", "  method: GET", "  urlPath: /api/test", "response: {}"].join("\n");

    const result = JSON.parse(contractToWireMock(makeContract("default.yaml", yaml)));

    expect(result.response.status).toBe(200);
  });

  it("should_throw_when_contract_has_no_request", () => {
    const yaml = ["response:", "  status: 200"].join("\n");

    expect(() => contractToWireMock(makeContract("bad.yaml", yaml))).toThrow(
      'missing required "request" field',
    );
  });

  it("should_throw_when_contract_has_no_response", () => {
    const yaml = ["request:", "  method: GET", "  urlPath: /test"].join("\n");

    expect(() => contractToWireMock(makeContract("bad.yaml", yaml))).toThrow(
      'missing required "response" field',
    );
  });

  it("should_throw_when_contract_has_no_method", () => {
    const yaml = ["request:", "  urlPath: /test", "response:", "  status: 200"].join("\n");

    expect(() => contractToWireMock(makeContract("bad.yaml", yaml))).toThrow(
      'missing required "method" field',
    );
  });

  it("should_throw_on_invalid_yaml", () => {
    expect(() => contractToWireMock(makeContract("bad.yaml", "{{invalid"))).toThrow(
      "Failed to parse YAML",
    );
  });

  it("should_reject_yaml_with_dangerous_type_tags", () => {
    const yaml = [
      "request:",
      "  method: GET",
      "  urlPath: !!js/function 'return process.exit(1)'",
      "response:",
      "  status: 200",
    ].join("\n");

    // JSON_SCHEMA rejects !!js/ tags — should throw during parsing
    expect(() => contractToWireMock(makeContract("evil.yaml", yaml))).toThrow();
  });

  it("should_produce_valid_json_output", () => {
    const yaml = [
      "request:",
      "  method: GET",
      "  urlPath: /api/test",
      "response:",
      "  status: 200",
    ].join("\n");

    const json = contractToWireMock(makeContract("test.yaml", yaml));

    // Should be pretty-printed valid JSON
    expect(() => JSON.parse(json)).not.toThrow();
    expect(json).toContain("\n"); // pretty-printed
  });

  it("should_roundtrip_through_parse_and_convert", () => {
    // A realistic contract with headers, body, query params
    const yaml = [
      "request:",
      "  method: POST",
      "  urlPath: /api/users",
      "  headers:",
      "    Content-Type: application/json",
      "    Accept: application/json",
      "  body:",
      '    name: "Alice"',
      "    age: 30",
      "response:",
      "  status: 201",
      "  headers:",
      "    Content-Type: application/json",
      "    Location: /api/users/1",
      "  body:",
      '    id: "1"',
      '    name: "Alice"',
      "    age: 30",
    ].join("\n");

    const wireMockJson = contractToWireMock(makeContract("roundtrip.yaml", yaml));
    const parsed = JSON.parse(wireMockJson);

    // Verify the WireMock structure is what Java Stub Runner expects
    expect(parsed.request.method).toBe("POST");
    expect(parsed.request.urlPath).toBe("/api/users");
    expect(parsed.request.headers["Content-Type"].equalTo).toBe("application/json");
    expect(parsed.request.headers["Accept"].equalTo).toBe("application/json");
    expect(parsed.request.bodyPatterns).toHaveLength(1);
    expect(parsed.response.status).toBe(201);
    expect(parsed.response.headers["Location"]).toBe("/api/users/1");
    expect(parsed.response.jsonBody.name).toBe("Alice");
    expect(parsed.response.jsonBody.age).toBe(30);
  });
});
