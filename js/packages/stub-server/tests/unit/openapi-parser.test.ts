import { describe, it, expect } from "vitest";
// These imports will fail until implementation exists (RED phase)
import { parseOpenApiContracts, looksLikeOpenApi } from "../../src/openapi-parser.js";

// @spec 042-openapi-contract-support AC6
describe("looksLikeOpenApi", () => {
  it("should_return_true_for_openapi_3_yaml", () => {
    const content = `openapi: 3.0.0
info:
  title: Test
  version: "1.0"
paths: {}`;
    expect(looksLikeOpenApi(content)).toBe(true);
  });

  it("should_return_true_for_swagger_2_yaml", () => {
    const content = `swagger: "2.0"
info:
  title: Test`;
    expect(looksLikeOpenApi(content)).toBe(true);
  });

  it("should_return_true_for_json_openapi", () => {
    const content = `{"openapi": "3.0.0", "info": {"title": "Test"}}`;
    expect(looksLikeOpenApi(content)).toBe(true);
  });

  it("should_return_true_for_quoted_openapi_yaml", () => {
    const content = `"openapi": "3.0.0"
info:
  title: Test`;
    expect(looksLikeOpenApi(content)).toBe(true);
  });

  it("should_return_false_for_scc_yaml", () => {
    const content = `request:
  method: GET
  urlPath: /api/orders/1
response:
  status: 200`;
    expect(looksLikeOpenApi(content)).toBe(false);
  });

  it("should_return_false_for_spring_config", () => {
    const content = `spring:
  application:
    name: my-service`;
    expect(looksLikeOpenApi(content)).toBe(false);
  });

  it("should_skip_comments_and_blank_lines", () => {
    const content = `# This is a comment

# Another comment
openapi: 3.0.0`;
    expect(looksLikeOpenApi(content)).toBe(true);
  });

  it("should_return_false_for_empty_string", () => {
    expect(looksLikeOpenApi("")).toBe(false);
  });
});

// @spec 042-openapi-contract-support AC1
describe("parseOpenApiContracts — basic GET conversion", () => {
  it("should_parse_GET_with_query_parameter_and_response_body", () => {
    const spec = EXAMPLE_SPEC;
    const contracts = parseOpenApiContracts("events-api.yaml", spec);

    const contract200 = contracts.find((c) => c.response.status === 200);
    expect(contract200).toBeDefined();
    expect(contract200!.request.method).toBe("GET");
    expect(contract200!.request.queryParameters).toEqual({ date: "2022-04-13" });
    expect(contract200!.response.status).toBe(200);
    expect(contract200!.response.body).toEqual({
      date: "2022-04-13",
      events: [
        {
          name: "Consumer-Driven Contract Workshops",
          startTime: "2022-04-13T11:00:00",
          durationInMinutes: "60",
          author: "Maciej Zielinski",
        },
      ],
    });
  });
});

// @spec 042-openapi-contract-support AC2
describe("parseOpenApiContracts — multiple contracts per operation", () => {
  it("should_produce_three_contracts_from_three_x_contracts_entries", () => {
    const contracts = parseOpenApiContracts("events-api.yaml", EXAMPLE_SPEC);

    expect(contracts).toHaveLength(3);

    const statuses = contracts.map((c) => c.response.status).sort();
    expect(statuses).toEqual([200, 400, 500]);
  });

  it("should_set_correct_response_body_per_contract", () => {
    const contracts = parseOpenApiContracts("events-api.yaml", EXAMPLE_SPEC);

    const contract400 = contracts.find((c) => c.response.status === 400)!;
    expect(contract400.response.body).toEqual({ message: "Invalid Request" });

    const contract500 = contracts.find((c) => c.response.status === 500)!;
    expect(contract500.response.body).toEqual({ message: "Unexpected Error" });
  });

  it("should_set_correct_query_parameter_per_contract", () => {
    const contracts = parseOpenApiContracts("events-api.yaml", EXAMPLE_SPEC);

    const contract400 = contracts.find((c) => c.response.status === 400)!;
    expect(contract400.request.queryParameters).toEqual({ date: "invalid-date" });

    const contract500 = contracts.find((c) => c.response.status === 500)!;
    expect(contract500.request.queryParameters).toEqual({ date: "2030-04-13" });
  });
});

// @spec 042-openapi-contract-support AC3
describe("parseOpenApiContracts — POST with request body", () => {
  it("should_parse_POST_with_body_and_content_type", () => {
    const spec = `
openapi: 3.0.0
info:
  title: User Service
  version: "1.0.0"
paths:
  /users:
    post:
      operationId: createUser
      x-contracts:
        - contractId: 1
          name: "create user"
      requestBody:
        content:
          application/json: {}
        x-contracts:
          - contractId: 1
            body:
              name: "John"
              email: "john@example.com"
      responses:
        '201':
          content:
            application/json: {}
          x-contracts:
            - contractId: 1
              body:
                id: 1
                name: "John"
              headers:
                Content-Type: application/json
`;
    const contracts = parseOpenApiContracts("user-service.yaml", spec);

    expect(contracts).toHaveLength(1);
    const contract = contracts[0];
    expect(contract.request.method).toBe("POST");
    expect(contract.request.body).toEqual({ name: "John", email: "john@example.com" });
    expect(contract.request.headers?.["Content-Type"]).toBe("application/json");
    expect(contract.response.status).toBe(201);
    expect(contract.response.body).toEqual({ id: 1, name: "John" });
  });
});

// @spec 042-openapi-contract-support AC4
describe("parseOpenApiContracts — path parameter substitution", () => {
  it("should_replace_path_parameter_placeholders_with_x_contracts_values", () => {
    const spec = `
openapi: 3.0.0
info:
  title: User Service
  version: "1.0.0"
paths:
  /users/{id}:
    get:
      operationId: getUser
      parameters:
        - name: id
          in: path
          x-contracts:
            - contractId: 1
              value: "123"
      x-contracts:
        - contractId: 1
          name: "get user by id"
      responses:
        '200':
          x-contracts:
            - contractId: 1
              body:
                id: 123
                name: "John"
`;
    const contracts = parseOpenApiContracts("user-service.yaml", spec);

    expect(contracts).toHaveLength(1);
    expect(contracts[0].request.urlPath).toBe("/users/123");
  });

  it("should_replace_multiple_path_parameters", () => {
    const spec = `
openapi: 3.0.0
info:
  title: Order Service
  version: "1.0.0"
paths:
  /orders/{orderId}/items/{itemId}:
    get:
      operationId: getOrderItem
      parameters:
        - name: orderId
          in: path
          x-contracts:
            - contractId: 1
              value: "order-42"
        - name: itemId
          in: path
          x-contracts:
            - contractId: 1
              value: "item-7"
      x-contracts:
        - contractId: 1
          name: "get order item"
      responses:
        '200':
          x-contracts:
            - contractId: 1
              body:
                id: "item-7"
`;
    const contracts = parseOpenApiContracts("order-service.yaml", spec);

    expect(contracts).toHaveLength(1);
    expect(contracts[0].request.urlPath).toBe("/orders/order-42/items/item-7");
  });
});

// @spec 042-openapi-contract-support AC5
describe("parseOpenApiContracts — contractPath override", () => {
  it("should_use_contractPath_instead_of_openapi_path", () => {
    const spec = `
openapi: 3.0.0
info:
  title: User Service
  version: "1.0.0"
paths:
  /users/{id}:
    get:
      operationId: getUser
      parameters:
        - name: id
          in: path
          x-contracts:
            - contractId: 1
              value: "123"
      x-contracts:
        - contractId: 1
          name: "get user"
          contractPath: "/custom/users/123"
      responses:
        '200':
          x-contracts:
            - contractId: 1
              body:
                id: 123
`;
    const contracts = parseOpenApiContracts("user-service.yaml", spec);

    expect(contracts).toHaveLength(1);
    expect(contracts[0].request.urlPath).toBe("/custom/users/123");
  });
});

// @spec 042-openapi-contract-support AC8
describe("parseOpenApiContracts — ignored contracts", () => {
  it("should_exclude_contracts_with_ignored_true", () => {
    const spec = `
openapi: 3.0.0
info:
  title: Test
  version: "1.0.0"
paths:
  /test:
    get:
      x-contracts:
        - contractId: 1
          name: "active"
        - contractId: 2
          name: "ignored"
          ignored: true
      responses:
        '200':
          x-contracts:
            - contractId: 1
              body: "ok"
            - contractId: 2
              body: "also ok"
`;
    const contracts = parseOpenApiContracts("test.yaml", spec);

    expect(contracts).toHaveLength(1);
    expect(contracts[0].name).toBe("active");
  });
});

// @spec 042-openapi-contract-support AC9
describe("parseOpenApiContracts — no x-contracts", () => {
  it("should_return_empty_when_no_x_contracts_present", () => {
    const spec = `
openapi: 3.0.0
info:
  title: Test
  version: "1.0.0"
paths:
  /test:
    get:
      operationId: getTest
      responses:
        '200':
          description: ok
`;
    const contracts = parseOpenApiContracts("test.yaml", spec);
    expect(contracts).toHaveLength(0);
  });

  it("should_return_empty_when_no_paths", () => {
    const spec = `
openapi: 3.0.0
info:
  title: Test
  version: "1.0.0"
paths: {}
`;
    const contracts = parseOpenApiContracts("test.yaml", spec);
    expect(contracts).toHaveLength(0);
  });
});

// @spec 042-openapi-contract-support — error cases
describe("parseOpenApiContracts — error handling", () => {
  it("should_throw_on_malformed_yaml", () => {
    expect(() => parseOpenApiContracts("bad.yaml", "{ invalid yaml: [")).toThrow();
  });

  it("should_set_contract_name_from_x_contracts_name", () => {
    const contracts = parseOpenApiContracts("events-api.yaml", EXAMPLE_SPEC);

    const contract200 = contracts.find((c) => c.response.status === 200)!;
    expect(contract200.name).toBe(
      "Should return events for given day with HTTP status code 200",
    );
  });

  it("should_fallback_name_to_method_path_contractId", () => {
    const spec = `
openapi: 3.0.0
info:
  title: Test
  version: "1.0.0"
paths:
  /test:
    get:
      x-contracts:
        - contractId: 1
      responses:
        '200':
          x-contracts:
            - contractId: 1
              body: "ok"
`;
    const contracts = parseOpenApiContracts("test.yaml", spec);
    expect(contracts).toHaveLength(1);
    expect(contracts[0].name).toContain("GET");
    expect(contracts[0].name).toContain("/test");
  });
});

// @spec 042-openapi-contract-support — response headers
describe("parseOpenApiContracts — response headers", () => {
  it("should_include_response_content_type_from_openapi_media_type", () => {
    const contracts = parseOpenApiContracts("events-api.yaml", EXAMPLE_SPEC);

    const contract200 = contracts.find((c) => c.response.status === 200)!;
    expect(contract200.response.headers?.["Content-Type"]).toBe("application/json");
  });
});

// @spec 042-openapi-contract-support — priority
describe("parseOpenApiContracts — priority", () => {
  it("should_set_priority_from_x_contracts", () => {
    const spec = `
openapi: 3.0.0
info:
  title: Test
  version: "1.0.0"
paths:
  /test:
    get:
      x-contracts:
        - contractId: 1
          name: "prioritized"
          priority: 5
      responses:
        '200':
          x-contracts:
            - contractId: 1
              body: "ok"
`;
    const contracts = parseOpenApiContracts("test.yaml", spec);
    expect(contracts).toHaveLength(1);
    expect(contracts[0].priority).toBe(5);
  });
});

// @spec 042-openapi-contract-support — request headers from operation-level x-contracts
describe("parseOpenApiContracts — request headers", () => {
  it("should_merge_headers_from_operation_x_contracts", () => {
    const spec = `
openapi: 3.0.0
info:
  title: Test
  version: "1.0.0"
paths:
  /test:
    get:
      x-contracts:
        - contractId: 1
          name: "with headers"
          headers:
            Accept: application/json
            X-Custom: custom-value
      responses:
        '200':
          x-contracts:
            - contractId: 1
              body: "ok"
`;
    const contracts = parseOpenApiContracts("test.yaml", spec);
    expect(contracts).toHaveLength(1);
    expect(contracts[0].request.headers).toEqual({
      Accept: "application/json",
      "X-Custom": "custom-value",
    });
  });

  it("should_include_header_parameters_from_x_contracts", () => {
    const spec = `
openapi: 3.0.0
info:
  title: Test
  version: "1.0.0"
paths:
  /test:
    get:
      parameters:
        - name: X-Trace-Id
          in: header
          x-contracts:
            - contractId: 1
              value: "trace-abc"
      x-contracts:
        - contractId: 1
          name: "with header param"
      responses:
        '200':
          x-contracts:
            - contractId: 1
              body: "ok"
`;
    const contracts = parseOpenApiContracts("test.yaml", spec);
    expect(contracts).toHaveLength(1);
    expect(contracts[0].request.headers?.["X-Trace-Id"]).toBe("trace-abc");
  });
});

// Mutation-killing tests for looksLikeOpenApi branches
describe("looksLikeOpenApi — mutation killers", () => {
  it("should_return_false_for_only_comments_and_blanks", () => {
    expect(looksLikeOpenApi("# just a comment\n\n# another")).toBe(false);
  });

  it("should_handle_content_without_newlines", () => {
    expect(looksLikeOpenApi("openapi: 3.0.0")).toBe(true);
  });

  it("should_return_false_for_yaml_starting_with_arbitrary_key", () => {
    expect(looksLikeOpenApi("server:\n  port: 8080")).toBe(false);
  });

  it("should_handle_swagger_in_json", () => {
    expect(looksLikeOpenApi('{"swagger": "2.0", "info": {}}')).toBe(true);
  });

  it("should_return_false_for_json_without_root_openapi", () => {
    expect(looksLikeOpenApi('{"info": {"openapi": "3.0.0"}}')).toBe(false);
  });
});

// Edge cases found by adversarial review
describe("looksLikeOpenApi — edge cases", () => {
  it("should_return_true_when_yaml_starts_with_document_separator", () => {
    const content = `---
openapi: 3.0.0
info:
  title: Test`;
    expect(looksLikeOpenApi(content)).toBe(true);
  });

  it("should_return_false_for_json_object_without_openapi_key", () => {
    // A JSON-style SCC contract must NOT be misidentified as OpenAPI
    const content = `{"request": {"method": "GET", "urlPath": "/test"}, "response": {"status": 200}}`;
    expect(looksLikeOpenApi(content)).toBe(false);
  });

  it("should_return_true_for_json_object_with_openapi_key", () => {
    const content = `{"openapi": "3.0.0", "info": {"title": "Test"}, "paths": {}}`;
    expect(looksLikeOpenApi(content)).toBe(true);
  });

  it("should_return_false_for_json_with_nested_openapi_in_body", () => {
    // A SCC contract whose response body mentions "openapi" should NOT be misidentified
    const content = `{"request":{"method":"GET","urlPath":"/spec"},"response":{"status":200,"body":{"openapi":"3.0.0"}}}`;
    expect(looksLikeOpenApi(content)).toBe(false);
  });
});

describe("parseOpenApiContracts — contractId type normalization", () => {
  it("should_match_string_contractId_with_numeric_contractId", () => {
    // YAML parses bare 1 as number and "1" as string — both should match
    const spec = `
openapi: 3.0.0
info:
  title: Test
  version: "1.0.0"
paths:
  /test:
    get:
      x-contracts:
        - contractId: "1"
          name: "string id"
      responses:
        '200':
          x-contracts:
            - contractId: 1
              body: "ok"
`;
    const contracts = parseOpenApiContracts("test.yaml", spec);
    expect(contracts).toHaveLength(1);
    expect(contracts[0].name).toBe("string id");
  });
});

describe("parseOpenApiContracts — null safety", () => {
  it("should_skip_null_elements_in_x_contracts_array", () => {
    const spec = `
openapi: 3.0.0
info:
  title: Test
  version: "1.0.0"
paths:
  /test:
    get:
      x-contracts:
        - null
        - contractId: 1
          name: "valid"
      responses:
        '200':
          x-contracts:
            - contractId: 1
              body: "ok"
`;
    const contracts = parseOpenApiContracts("test.yaml", spec);
    expect(contracts).toHaveLength(1);
    expect(contracts[0].name).toBe("valid");
  });

  it("should_skip_contractId_null", () => {
    const spec = `
openapi: 3.0.0
info:
  title: Test
  version: "1.0.0"
paths:
  /test:
    get:
      x-contracts:
        - contractId: null
          name: "null id"
        - contractId: 1
          name: "valid"
      responses:
        '200':
          x-contracts:
            - contractId: 1
              body: "ok"
`;
    const contracts = parseOpenApiContracts("test.yaml", spec);
    expect(contracts).toHaveLength(1);
    expect(contracts[0].name).toBe("valid");
  });
});

// Mutation-killing tests for defensive branches
describe("parseOpenApiContracts — defensive branches", () => {
  it("should_return_empty_for_scalar_yaml", () => {
    expect(parseOpenApiContracts("scalar.yaml", "openapi: 3.0.0")).toHaveLength(0);
  });

  it("should_return_empty_for_null_yaml", () => {
    expect(parseOpenApiContracts("null.yaml", "null")).toHaveLength(0);
  });

  it("should_return_empty_for_paths_null", () => {
    const spec = `openapi: 3.0.0\ninfo:\n  title: T\npaths: null`;
    expect(parseOpenApiContracts("test.yaml", spec)).toHaveLength(0);
  });

  it("should_skip_null_path_items", () => {
    const spec = `
openapi: 3.0.0
info:
  title: T
  version: "1"
paths:
  /null-item: null
  /real:
    get:
      x-contracts:
        - contractId: 1
      responses:
        '200':
          x-contracts:
            - contractId: 1
              body: ok
`;
    const contracts = parseOpenApiContracts("test.yaml", spec);
    expect(contracts).toHaveLength(1);
    expect(contracts[0]!.request.urlPath).toBe("/real");
  });

  it("should_skip_operations_without_x_contracts", () => {
    const spec = `
openapi: 3.0.0
info:
  title: T
  version: "1"
paths:
  /test:
    get:
      responses:
        '200':
          description: ok
    post:
      x-contracts:
        - contractId: 1
      responses:
        '201':
          x-contracts:
            - contractId: 1
              body: created
`;
    const contracts = parseOpenApiContracts("test.yaml", spec);
    expect(contracts).toHaveLength(1);
    expect(contracts[0]!.request.method).toBe("POST");
  });

  it("should_skip_contractId_undefined", () => {
    const spec = `
openapi: 3.0.0
info:
  title: T
  version: "1"
paths:
  /test:
    get:
      x-contracts:
        - name: "no id"
      responses:
        '200':
          x-contracts:
            - body: ok
`;
    expect(parseOpenApiContracts("test.yaml", spec)).toHaveLength(0);
  });

  it("should_skip_non_numeric_response_keys", () => {
    const spec = `
openapi: 3.0.0
info:
  title: T
  version: "1"
paths:
  /test:
    get:
      x-contracts:
        - contractId: 1
      responses:
        'default':
          x-contracts:
            - contractId: 1
              body: ok
`;
    expect(parseOpenApiContracts("test.yaml", spec)).toHaveLength(0);
  });

  it("should_handle_request_body_without_content", () => {
    const spec = `
openapi: 3.0.0
info:
  title: T
  version: "1"
paths:
  /test:
    post:
      x-contracts:
        - contractId: 1
      requestBody:
        description: no content key
      responses:
        '201':
          x-contracts:
            - contractId: 1
              body: ok
`;
    const contracts = parseOpenApiContracts("test.yaml", spec);
    expect(contracts).toHaveLength(1);
    expect(contracts[0]!.request.headers).toBeUndefined();
  });

  it("should_handle_response_without_content_for_content_type", () => {
    const spec = `
openapi: 3.0.0
info:
  title: T
  version: "1"
paths:
  /test:
    get:
      x-contracts:
        - contractId: 1
      responses:
        '204':
          description: no content
          x-contracts:
            - contractId: 1
`;
    const contracts = parseOpenApiContracts("test.yaml", spec);
    expect(contracts).toHaveLength(1);
    expect(contracts[0]!.response.headers).toBeUndefined();
    expect(contracts[0]!.response.status).toBe(204);
  });

  it("should_derive_content_type_from_response_media_when_x_contracts_headers_absent", () => {
    const spec = `
openapi: 3.0.0
info:
  title: T
  version: "1"
paths:
  /test:
    get:
      x-contracts:
        - contractId: 1
      responses:
        '200':
          content:
            text/plain: {}
          x-contracts:
            - contractId: 1
              body: hello
`;
    const contracts = parseOpenApiContracts("test.yaml", spec);
    expect(contracts).toHaveLength(1);
    expect(contracts[0]!.response.headers?.["Content-Type"]).toBe("text/plain");
  });

  it("should_handle_path_param_with_no_matching_x_contracts_value", () => {
    const spec = `
openapi: 3.0.0
info:
  title: T
  version: "1"
paths:
  /users/{id}:
    get:
      parameters:
        - name: id
          in: path
      x-contracts:
        - contractId: 1
      responses:
        '200':
          x-contracts:
            - contractId: 1
              body: ok
`;
    const contracts = parseOpenApiContracts("test.yaml", spec);
    expect(contracts).toHaveLength(1);
    // Unresolved — placeholder stays
    expect(contracts[0]!.request.urlPath).toBe("/users/{id}");
  });

  it("should_use_request_body_content_type_as_header", () => {
    const spec = `
openapi: 3.0.0
info:
  title: T
  version: "1"
paths:
  /test:
    post:
      x-contracts:
        - contractId: 1
      requestBody:
        content:
          application/xml: {}
        x-contracts:
          - contractId: 1
            body: "<data/>"
      responses:
        '200':
          x-contracts:
            - contractId: 1
              body: ok
`;
    const contracts = parseOpenApiContracts("test.yaml", spec);
    expect(contracts).toHaveLength(1);
    expect(contracts[0]!.request.headers?.["Content-Type"]).toBe("application/xml");
    expect(contracts[0]!.request.body).toBe("<data/>");
  });

  it("should_not_override_explicit_content_type_header_with_media_type", () => {
    const spec = `
openapi: 3.0.0
info:
  title: T
  version: "1"
paths:
  /test:
    post:
      x-contracts:
        - contractId: 1
          headers:
            Content-Type: text/custom
      requestBody:
        content:
          application/json: {}
        x-contracts:
          - contractId: 1
            body: "{}"
      responses:
        '200':
          x-contracts:
            - contractId: 1
              body: ok
`;
    const contracts = parseOpenApiContracts("test.yaml", spec);
    expect(contracts).toHaveLength(1);
    expect(contracts[0]!.request.headers?.["Content-Type"]).toBe("text/custom");
  });

  it("should_skip_param_without_name", () => {
    const spec = `
openapi: 3.0.0
info:
  title: T
  version: "1"
paths:
  /test/{id}:
    get:
      parameters:
        - in: path
          x-contracts:
            - contractId: 1
              value: "123"
      x-contracts:
        - contractId: 1
      responses:
        '200':
          x-contracts:
            - contractId: 1
              body: ok
`;
    const contracts = parseOpenApiContracts("test.yaml", spec);
    expect(contracts).toHaveLength(1);
    // param has no name so placeholder stays
    expect(contracts[0]!.request.urlPath).toBe("/test/{id}");
  });

  it("should_skip_non_path_params_in_url_resolution", () => {
    const spec = `
openapi: 3.0.0
info:
  title: T
  version: "1"
paths:
  /test:
    get:
      parameters:
        - name: filter
          in: query
          x-contracts:
            - contractId: 1
              value: "active"
      x-contracts:
        - contractId: 1
      responses:
        '200':
          x-contracts:
            - contractId: 1
              body: ok
`;
    const contracts = parseOpenApiContracts("test.yaml", spec);
    expect(contracts).toHaveLength(1);
    expect(contracts[0]!.request.urlPath).toBe("/test");
    expect(contracts[0]!.request.queryParameters).toEqual({ filter: "active" });
  });

  it("should_drop_contract_when_response_has_no_matching_contractId", () => {
    const spec = `
openapi: 3.0.0
info:
  title: T
  version: "1"
paths:
  /test:
    get:
      x-contracts:
        - contractId: 1
        - contractId: 2
      responses:
        '200':
          x-contracts:
            - contractId: 1
              body: ok
`;
    const contracts = parseOpenApiContracts("test.yaml", spec);
    // contractId 2 has no matching response → dropped
    expect(contracts).toHaveLength(1);
    expect(contracts[0]!.response.status).toBe(200);
  });

  it("should_generate_fallback_name_when_name_is_empty_string", () => {
    const spec = `
openapi: 3.0.0
info:
  title: T
  version: "1"
paths:
  /test:
    get:
      x-contracts:
        - contractId: 1
          name: ""
      responses:
        '200':
          x-contracts:
            - contractId: 1
              body: ok
`;
    const contracts = parseOpenApiContracts("test.yaml", spec);
    expect(contracts).toHaveLength(1);
    expect(contracts[0]!.name).toBe("GET /test #1");
  });

  it("should_skip_non_string_header_values", () => {
    const spec = `
openapi: 3.0.0
info:
  title: T
  version: "1"
paths:
  /test:
    get:
      x-contracts:
        - contractId: 1
          headers:
            X-Valid: "value"
            X-Number: 42
      responses:
        '200':
          x-contracts:
            - contractId: 1
              body: ok
`;
    const contracts = parseOpenApiContracts("test.yaml", spec);
    expect(contracts).toHaveLength(1);
    expect(contracts[0]!.request.headers).toEqual({ "X-Valid": "value" });
  });
});

// Full example from stubborn-openapi test resources
const EXAMPLE_SPEC = `
openapi: 3.0.0
info:
  version: "1.0.0"
  description: "Example how to define x-contract inside OpenAPI 3.0"
  title: Spring Cloud Contract OpenAPI 3.0 Basic Example
paths:
  /v1/events:
    get:
      operationId: 'conference-events'
      summary: Retrieve all events for given day
      parameters:
        - in: query
          name: date
          schema:
            type: string
            format: date
          required: true
          x-contracts:
            - contractId: 200
              value: '2022-04-13'
            - contractId: 400
              value: 'invalid-date'
            - contractId: 500
              value: '2030-04-13'
      x-contracts:
        - contractId: 200
          name: Should return events for given day with HTTP status code 200
        - contractId: 400
          name: Should return HTTP status code 400 when date has invalid value
        - contractId: 500
          name: Should return HTTP status code 500 when server has unexpected problems
      responses:
        '200':
          description: return conference events for given day
          content:
            application/json:
              schema:
                type: object
          x-contracts:
            - contractId: 200
              body:
                date: '2022-04-13'
                events:
                  - name: 'Consumer-Driven Contract Workshops'
                    startTime: '2022-04-13T11:00:00'
                    durationInMinutes: '60'
                    author: 'Maciej Zielinski'
              headers:
                Content-Type: application/json
        '400':
          description: Bad Request
          content:
            application/json:
              schema:
                type: object
          x-contracts:
            - contractId: 400
              body:
                message: 'Invalid Request'
              headers:
                Content-Type: application/json
        '500':
          description: Internal Server Error
          content:
            application/json:
              schema:
                type: object
          x-contracts:
            - contractId: 500
              body:
                message: 'Unexpected Error'
              headers:
                Content-Type: application/json
`;
