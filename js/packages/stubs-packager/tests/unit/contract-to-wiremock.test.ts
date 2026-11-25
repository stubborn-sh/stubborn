import { describe, it, expect } from "vitest";
import { contractToWireMock, convertContract } from "../../src/contract-to-wiremock.js";
import type { ScannedContract } from "@stubborn-sh/publisher";

function makeContract(name: string, yamlContent: string): ScannedContract {
  return { contractName: name, content: yamlContent, contentType: "application/x-yaml" };
}

const TRANSFORMERS = ["response-template", "stubborn-contract"];

/**
 * The expected mappings are the ones the JVM (YamlContractConverter + DslToWireMockClientConverter,
 * as the Maven/Gradle plugins run them) writes for the same YAML, without their random `id`/`uuid`.
 * stub-server's parity test pins the conversion on a much larger corpus.
 */
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

    // The JVM writes the response body as a JSON string, not a jsonBody.
    expect(result).toEqual({
      request: { urlPath: "/api/orders/1", method: "GET" },
      response: {
        status: 200,
        body: '{"id":"1","product":"Laptop","amount":999.99}',
        headers: { "Content-Type": "application/json" },
        transformers: TRANSFORMERS,
      },
    });
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

    // A JSON request body is matched field by field (matchesJsonPath), not with equalToJson.
    expect(result).toEqual({
      request: {
        urlPath: "/api/orders",
        method: "POST",
        headers: { "Content-Type": { equalTo: "application/json" } },
        bodyPatterns: [
          { matchesJsonPath: "$[?(@.['product'] == 'iPhone')]" },
          { matchesJsonPath: "$[?(@.['amount'] == 799)]" },
        ],
      },
      response: {
        status: 201,
        body: '{"id":"42","product":"iPhone","amount":799,"status":"CREATED"}',
        transformers: TRANSFORMERS,
      },
    });
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

  it("should_convert_url_with_a_query_string_to_a_url_path_as_the_jvm_does", () => {
    const yaml = [
      "request:",
      "  method: GET",
      "  url: /api/orders?status=PENDING",
      "response:",
      "  status: 200",
    ].join("\n");

    const result = JSON.parse(contractToWireMock(makeContract("url.yaml", yaml)));

    // The JVM writes `url` as a urlPath (query string included), so the stub never matches a
    // request with that query string: the contract should use queryParameters.
    expect(result.request).toEqual({ urlPath: "/api/orders?status=PENDING", method: "GET" });
    expect(result.request.url).toBeUndefined();
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

  it("should_match_a_text_request_body_with_equal_to", () => {
    const yaml = [
      "request:",
      "  method: POST",
      "  url: /text",
      "  headers:",
      "    Content-Type: text/plain",
      '  body: "hello world"',
      "response:",
      "  status: 200",
    ].join("\n");

    const result = JSON.parse(contractToWireMock(makeContract("text.yaml", yaml)));

    expect(result.request.bodyPatterns).toEqual([{ equalTo: "hello world" }]);
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

  it("should_throw_when_the_response_has_no_status_as_the_jvm_does", () => {
    const yaml = ["request:", "  method: GET", "  urlPath: /api/test", "response: {}"].join("\n");

    // The JVM fails the build (a NullPointerException on the status).
    expect(() => contractToWireMock(makeContract("default.yaml", yaml))).toThrow(
      "response.status is required",
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

    expect(() => contractToWireMock(makeContract("evil.yaml", yaml))).toThrow();
  });

  it("should_throw_when_the_jvm_rejects_the_contract", () => {
    const yaml = [
      "request:",
      "  method: GET",
      "  url: /h",
      "  headers:",
      "    foo: bar",
      "  matchers:",
      "    headers:",
      "      - key: foo",
      "        regex: baz",
      "response:",
      "  status: 200",
    ].join("\n");

    expect(() => contractToWireMock(makeContract("broken.yaml", yaml))).toThrow(
      "is not matched by regex [baz]",
    );
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

    expect(() => JSON.parse(json)).not.toThrow();
    expect(json).toContain("\n"); // pretty-printed
  });

  it("should_roundtrip_through_parse_and_convert", () => {
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

    const parsed = JSON.parse(contractToWireMock(makeContract("roundtrip.yaml", yaml)));

    expect(parsed).toEqual({
      request: {
        urlPath: "/api/users",
        method: "POST",
        headers: {
          "Content-Type": { equalTo: "application/json" },
          Accept: { equalTo: "application/json" },
        },
        bodyPatterns: [
          { matchesJsonPath: "$[?(@.['name'] == 'Alice')]" },
          { matchesJsonPath: "$[?(@.['age'] == 30)]" },
        ],
      },
      response: {
        status: 201,
        body: '{"id":"1","name":"Alice","age":30}',
        headers: { "Content-Type": "application/json", Location: "/api/users/1" },
        transformers: TRANSFORMERS,
      },
    });
  });

  it("should_refuse_a_file_with_several_stubs", () => {
    const yaml = [
      "request: {method: GET, url: /one}",
      "response: {status: 200}",
      "---",
      "request: {method: GET, url: /two}",
      "response: {status: 200}",
    ].join("\n");

    expect(() => contractToWireMock(makeContract("two.yaml", yaml))).toThrow("generates 2");
  });
});

describe("convertContract", () => {
  it("should_give_one_mapping_per_contract_named_as_the_jvm_names_them", () => {
    const yaml = [
      "request: {method: GET, url: /one}",
      "response: {status: 200}",
      "---",
      "name: second contract",
      "request: {method: GET, url: /two}",
      "response: {status: 201}",
      "---",
      "label: a message",
      "input: {triggeredBy: trigger()}",
      "outputMessage: {sentTo: topic, body: {a: b}}",
      "---",
      "- request: {method: GET, url: /four}",
      "  response: {status: 204}",
    ].join("\n");

    const { stubs, skipped } = convertContract(makeContract("orders/multi.yml", yaml));

    expect(stubs.map((s) => s.fileName)).toEqual([
      "multi.json",
      "second contract.json",
      "multi_3.json",
    ]);
    expect(stubs.map((s) => (JSON.parse(s.json) as { request: unknown }).request)).toEqual([
      { urlPath: "/one", method: "GET" },
      { urlPath: "/two", method: "GET" },
      { urlPath: "/four", method: "GET" },
    ]);
    expect(skipped).toEqual([]);
  });

  it("should_skip_a_messaging_contract", () => {
    const yaml = [
      "label: a message",
      "input: {triggeredBy: trigger()}",
      "outputMessage: {sentTo: topic, body: {a: b}}",
    ].join("\n");

    const { stubs, skipped } = convertContract(makeContract("message.yml", yaml));

    expect(stubs).toEqual([]);
    expect(skipped).toEqual(["message.yml: no HTTP contract (a messaging contract)"]);
  });

  it("should_skip_an_ignored_contract", () => {
    const yaml = [
      "ignored: true",
      "request: {method: GET, url: /ignored}",
      "response: {status: 200}",
    ].join("\n");

    const { stubs, skipped } = convertContract(makeContract("ignored.yml", yaml));

    expect(stubs).toEqual([]);
    expect(skipped).toEqual(["ignored.yml (ignored): ignored"]);
  });

  it("should_inline_the_files_a_contract_references", () => {
    const yaml = [
      "request:",
      "  method: POST",
      "  url: /file",
      "  headers:",
      "    Content-Type: application/json",
      "  bodyFromFile: files/req.json",
      "response:",
      "  status: 200",
      "  bodyFromFileAsBytes: files/blob.bin",
    ].join("\n");
    const files: Record<string, Uint8Array> = {
      "files/req.json": Buffer.from('{"fromFile":"request","n":1}\n'),
      "files/blob.bin": Uint8Array.from([0, 1, 2, 255]),
    };

    const result = convertContract(makeContract("file.yml", yaml), {
      readFile: (path) => files[path],
    });

    expect(JSON.parse(result.stubs[0]?.json ?? "{}")).toEqual({
      request: {
        urlPath: "/file",
        method: "POST",
        headers: { "Content-Type": { equalTo: "application/json" } },
        bodyPatterns: [
          { matchesJsonPath: "$[?(@.['fromFile'] == 'request')]" },
          { matchesJsonPath: "$[?(@.['n'] == 1)]" },
        ],
      },
      response: { status: 200, base64Body: "AAEC/w==", transformers: TRANSFORMERS },
    });
    expect([...result.files.keys()].sort()).toEqual(["files/blob.bin", "files/req.json"]);
  });

  it("should_throw_when_a_referenced_file_is_missing", () => {
    const yaml = [
      "request: {method: GET, url: /f}",
      "response: {status: 200, bodyFromFile: missing.json}",
    ].join("\n");

    expect(() =>
      convertContract(makeContract("missing.yml", yaml), { readFile: () => undefined }),
    ).toThrow("file not found next to the contract (bodyFromFile: missing.json)");
  });
});
