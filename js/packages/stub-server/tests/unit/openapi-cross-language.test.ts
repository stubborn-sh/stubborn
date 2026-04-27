import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseOpenApiContracts, looksLikeOpenApi } from "../../src/openapi-parser.js";

/**
 * Cross-language: Java stubborn-openapi → JS stub-server.
 *
 * The Java `stubborn-openapi` library converts OpenAPI 3.x specs with
 * `x-contracts` extensions into Spring Cloud Contract objects. This test
 * verifies the JS `parseOpenApiContracts` produces equivalent ParsedContract
 * objects from the same OpenAPI fixture used by the Java test suite.
 *
 * Fixture: stubborn-openapi/src/test/resources/openapi/openapi-scco3-example.yml
 *
 * If the fixture is missing (stubborn-openapi not cloned alongside), tests
 * are skipped gracefully.
 */

const JAVA_OPENAPI_FIXTURE_YML = resolve(
  import.meta.dirname,
  "../../../../../stubborn-openapi/src/test/resources/openapi/openapi-scco3-example.yml",
);

const JAVA_OPENAPI_FIXTURE_JSON = resolve(
  import.meta.dirname,
  "../../../../../stubborn-openapi/src/test/resources/openapi/openapi-scco3-example.json",
);

async function loadFixture(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf-8");
  } catch {
    return null;
  }
}

describe("Cross-language: Java OpenAPI fixture → JS parser (YAML)", () => {
  let yamlContent: string;

  it("should_load_java_fixture", async () => {
    const content = await loadFixture(JAVA_OPENAPI_FIXTURE_YML);
    if (content === null) {
      console.warn(
        "Skipping cross-language tests: stubborn-openapi fixture not found at",
        JAVA_OPENAPI_FIXTURE_YML,
      );
      return;
    }
    yamlContent = content;
    expect(yamlContent).toContain("openapi");
  });

  it("should_be_detected_as_openapi", () => {
    if (yamlContent === undefined) return;
    expect(looksLikeOpenApi(yamlContent)).toBe(true);
  });

  it("should_produce_three_contracts_matching_java_converter_output", () => {
    if (yamlContent === undefined) return;

    // given — the Java OpenApiContractConverter produces 3 contracts from this fixture
    // (contractId 200, 400, 500) each for GET /v1/events

    // when
    const contracts = parseOpenApiContracts("openapi-scco3-example.yml", yamlContent);

    // then — same count as Java
    expect(contracts).toHaveLength(3);
  });

  it("should_produce_correct_http_method_and_path_for_all_contracts", () => {
    if (yamlContent === undefined) return;

    const contracts = parseOpenApiContracts("openapi-scco3-example.yml", yamlContent);

    // All contracts are GET /v1/events (Java converter derives the same)
    for (const contract of contracts) {
      expect(contract.request.method).toBe("GET");
      expect(contract.request.urlPath).toBe("/v1/events");
    }
  });

  it("should_produce_correct_status_codes_200_400_500", () => {
    if (yamlContent === undefined) return;

    const contracts = parseOpenApiContracts("openapi-scco3-example.yml", yamlContent);

    const statuses = contracts.map((c) => c.response.status).sort();
    // Java converter produces the same three status codes
    expect(statuses).toEqual([200, 400, 500]);
  });

  it("should_produce_correct_query_parameter_per_contractId", () => {
    if (yamlContent === undefined) return;

    const contracts = parseOpenApiContracts("openapi-scco3-example.yml", yamlContent);

    // Java converter correlates parameter x-contracts by contractId
    const c200 = contracts.find((c) => c.response.status === 200)!;
    expect(c200.request.queryParameters).toEqual({ date: "2022-04-13" });

    const c400 = contracts.find((c) => c.response.status === 400)!;
    expect(c400.request.queryParameters).toEqual({ date: "invalid-date" });

    const c500 = contracts.find((c) => c.response.status === 500)!;
    expect(c500.request.queryParameters).toEqual({ date: "2030-04-13" });
  });

  it("should_produce_correct_contract_names", () => {
    if (yamlContent === undefined) return;

    const contracts = parseOpenApiContracts("openapi-scco3-example.yml", yamlContent);

    // Java converter takes the name from x-contracts[].name
    const names = contracts.map((c) => c.name).sort();
    expect(names).toEqual([
      "Should return HTTP status code 400 when date has invalid value",
      "Should return HTTP status code 500 when server has unexpected problems",
      "Should return events for given day with HTTP status code 200",
    ]);
  });

  it("should_produce_correct_200_response_body", () => {
    if (yamlContent === undefined) return;

    const contracts = parseOpenApiContracts("openapi-scco3-example.yml", yamlContent);
    const c200 = contracts.find((c) => c.response.status === 200)!;

    // Java converter extracts body from response x-contracts
    expect(c200.response.body).toEqual({
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

  it("should_produce_correct_error_response_bodies", () => {
    if (yamlContent === undefined) return;

    const contracts = parseOpenApiContracts("openapi-scco3-example.yml", yamlContent);

    const c400 = contracts.find((c) => c.response.status === 400)!;
    expect(c400.response.body).toEqual({ message: "Invalid Request" });

    const c500 = contracts.find((c) => c.response.status === 500)!;
    expect(c500.response.body).toEqual({ message: "Unexpected Error" });
  });

  it("should_produce_content_type_response_header", () => {
    if (yamlContent === undefined) return;

    const contracts = parseOpenApiContracts("openapi-scco3-example.yml", yamlContent);

    // Java converter merges Content-Type from response x-contracts headers
    for (const contract of contracts) {
      expect(contract.response.headers?.["Content-Type"]).toBe("application/json");
    }
  });
});

describe("Cross-language: Java OpenAPI fixture → JS parser (JSON)", () => {
  let jsonContent: string;

  it("should_load_json_fixture", async () => {
    const content = await loadFixture(JAVA_OPENAPI_FIXTURE_JSON);
    if (content === null) {
      console.warn("Skipping JSON cross-language tests: fixture not found");
      return;
    }
    jsonContent = content;
    expect(jsonContent).toContain("openapi");
  });

  it("should_be_detected_as_openapi", () => {
    if (jsonContent === undefined) return;
    expect(looksLikeOpenApi(jsonContent)).toBe(true);
  });

  it("should_produce_identical_contracts_from_json_as_from_yaml", async () => {
    const yamlContent = await loadFixture(JAVA_OPENAPI_FIXTURE_YML);
    if (jsonContent === undefined || yamlContent === null) return;

    // given
    const fromYaml = parseOpenApiContracts("example.yml", yamlContent);
    const fromJson = parseOpenApiContracts("example.json", jsonContent);

    // then — same count
    expect(fromJson).toHaveLength(fromYaml.length);

    // then — same status codes
    const yamlStatuses = fromYaml.map((c) => c.response.status).sort();
    const jsonStatuses = fromJson.map((c) => c.response.status).sort();
    expect(jsonStatuses).toEqual(yamlStatuses);

    // then — same contract names
    const yamlNames = fromYaml.map((c) => c.name).sort();
    const jsonNames = fromJson.map((c) => c.name).sort();
    expect(jsonNames).toEqual(yamlNames);

    // then — same response bodies
    for (const status of yamlStatuses) {
      const yamlContract = fromYaml.find((c) => c.response.status === status)!;
      const jsonContract = fromJson.find((c) => c.response.status === status)!;
      expect(jsonContract.response.body).toEqual(yamlContract.response.body);
      expect(jsonContract.request.queryParameters).toEqual(yamlContract.request.queryParameters);
    }
  });
});
