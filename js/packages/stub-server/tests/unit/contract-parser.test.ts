import { describe, it, expect } from "vitest";
import { parseContract } from "../../src/contract-parser.js";

describe("parseContract", () => {
  it("should_parse_valid_GET_contract", () => {
    const yaml = `
request:
  method: GET
  urlPath: /api/orders/1
response:
  status: 200
  headers:
    Content-Type: application/json
  body:
    id: "1"
    product: "MacBook Pro"
`;
    const contract = parseContract("shouldReturnOrder.yaml", yaml);
    expect(contract.name).toBe("shouldReturnOrder.yaml");
    expect(contract.request.method).toBe("GET");
    expect(contract.request.urlPath).toBe("/api/orders/1");
    expect(contract.response.status).toBe(200);
    expect(contract.response.headers?.["Content-Type"]).toBe("application/json");
    expect(contract.response.body).toEqual({ id: "1", product: "MacBook Pro" });
  });

  it("should_parse_valid_POST_contract_with_matchers", () => {
    const yaml = `
request:
  method: POST
  url: /api/orders
  headers:
    Content-Type: application/json
  body:
    product: "iPhone 16"
    amount: 999.99
response:
  status: 201
  headers:
    Content-Type: application/json
  body:
    product: "iPhone 16"
    amount: 999.99
    status: "CREATED"
  matchers:
    body:
      - path: $.id
        type: by_regex
        value: "[0-9]+"
`;
    const contract = parseContract("shouldCreateOrder.yaml", yaml);
    expect(contract.request.method).toBe("POST");
    expect(contract.request.url).toBe("/api/orders");
    expect(contract.request.body).toEqual({ product: "iPhone 16", amount: 999.99 });
    expect(contract.response.status).toBe(201);
    expect(contract.response.matchers?.body).toHaveLength(1);
    expect(contract.response.matchers?.body?.[0]?.path).toBe("$.id");
    expect(contract.response.matchers?.body?.[0]?.type).toBe("by_regex");
    expect(contract.response.matchers?.body?.[0]?.value).toBe("[0-9]+");
  });

  it("should_throw_on_malformed_yaml", () => {
    expect(() => parseContract("bad.yaml", "{{invalid")).toThrow("Failed to parse YAML");
  });

  it("should_throw_on_non_object_yaml", () => {
    expect(() => parseContract("bad.yaml", "just a string")).toThrow("not a valid object");
  });

  it("should_throw_when_request_is_missing", () => {
    expect(() => parseContract("bad.yaml", "response:\n  status: 200")).toThrow(
      'missing required "request"',
    );
  });

  it("should_throw_when_response_is_missing", () => {
    expect(() => parseContract("bad.yaml", "request:\n  method: GET\n  url: /api")).toThrow(
      'missing required "response"',
    );
  });

  it("should_throw_when_method_is_missing", () => {
    expect(() =>
      parseContract("bad.yaml", "request:\n  url: /api\nresponse:\n  status: 200"),
    ).toThrow('missing required "method"');
  });

  it("should_throw_when_url_and_urlPath_are_missing", () => {
    expect(() =>
      parseContract("bad.yaml", "request:\n  method: GET\nresponse:\n  status: 200"),
    ).toThrow('must have either "url" or "urlPath"');
  });

  it("should_default_status_to_200", () => {
    const yaml = "request:\n  method: GET\n  url: /api\nresponse:\n  body: ok";
    const contract = parseContract("test.yaml", yaml);
    expect(contract.response.status).toBe(200);
  });

  it("should_normalize_method_to_uppercase", () => {
    const yaml = "request:\n  method: post\n  url: /api\nresponse:\n  status: 201";
    const contract = parseContract("test.yaml", yaml);
    expect(contract.request.method).toBe("POST");
  });

  it("should_parse_query_parameters", () => {
    const yaml = `
request:
  method: GET
  urlPath: /api/search
  queryParameters:
    q: "test"
    page: "1"
response:
  status: 200
`;
    const contract = parseContract("test.yaml", yaml);
    expect(contract.request.queryParameters?.q).toBe("test");
    expect(contract.request.queryParameters?.page).toBe("1");
  });
});
