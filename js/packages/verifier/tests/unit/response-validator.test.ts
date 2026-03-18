import { describe, it, expect } from "vitest";
import { validateResponse } from "../../src/response-validator.js";
import type { ParsedContract } from "@spring-cloud-contract/stub-server";
import type { ExecutionResult } from "../../src/request-executor.js";

function makeContract(overrides: Partial<ParsedContract["response"]> = {}): ParsedContract {
  return {
    name: "test.yaml",
    request: { method: "GET", url: "/api" },
    response: {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: { id: "1", name: "test" },
      ...overrides,
    },
  };
}

function makeResult(overrides: Partial<ExecutionResult> = {}): ExecutionResult {
  return {
    status: 200,
    headers: { "content-type": "application/json" },
    body: { id: "1", name: "test" },
    ...overrides,
  };
}

describe("validateResponse", () => {
  it("should_pass_when_response_matches", () => {
    const result = validateResponse(makeContract(), makeResult());
    expect(result.valid).toBe(true);
    expect(result.failures).toHaveLength(0);
  });

  it("should_fail_on_status_mismatch", () => {
    const result = validateResponse(makeContract(), makeResult({ status: 404 }));
    expect(result.valid).toBe(false);
    expect(result.failures.some((f) => f.field === "status")).toBe(true);
  });

  it("should_fail_on_missing_header", () => {
    const result = validateResponse(makeContract(), makeResult({ headers: {} }));
    expect(result.valid).toBe(false);
    expect(result.failures.some((f) => f.field.includes("Content-Type"))).toBe(true);
  });

  it("should_fail_on_body_mismatch", () => {
    const result = validateResponse(
      makeContract(),
      makeResult({ body: { id: "2", name: "other" } }),
    );
    expect(result.valid).toBe(false);
    expect(result.failures.some((f) => f.field === "body")).toBe(true);
  });

  it("should_validate_by_regex_matcher", () => {
    const contract = makeContract({
      body: { id: "1", name: "test" },
      matchers: {
        body: [{ path: "$.id", type: "by_regex", value: "[0-9]+" }],
      },
    });
    const result = validateResponse(contract, makeResult({ body: { id: "42", name: "test" } }));
    expect(result.valid).toBe(true);
  });

  it("should_fail_by_regex_matcher_when_not_matching", () => {
    const contract = makeContract({
      body: { id: "1", name: "test" },
      matchers: {
        body: [{ path: "$.id", type: "by_regex", value: "[0-9]+" }],
      },
    });
    const result = validateResponse(contract, makeResult({ body: { id: "abc", name: "test" } }));
    expect(result.valid).toBe(false);
  });

  it("should_validate_by_type_matcher", () => {
    const contract = makeContract({
      body: { id: "1", name: "test" },
      matchers: {
        body: [{ path: "$.id", type: "by_type" }],
      },
    });
    const result = validateResponse(
      contract,
      makeResult({ body: { id: "any-string", name: "test" } }),
    );
    expect(result.valid).toBe(true);
  });

  it("should_include_contract_name_in_result", () => {
    const result = validateResponse(makeContract(), makeResult());
    expect(result.contractName).toBe("test.yaml");
  });

  it("should_pass_when_contract_has_no_body", () => {
    const contract = makeContract({ body: undefined });
    const result = validateResponse(contract, makeResult({ body: { anything: true } }));
    expect(result.valid).toBe(true);
  });
});
