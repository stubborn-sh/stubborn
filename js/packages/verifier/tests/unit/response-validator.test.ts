import { describe, it, expect } from "vitest";
import { validateResponse } from "../../src/response-validator.js";
import type { ParsedContract } from "@stubborn-sh/stub-server";
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

describe("validateResponse body matchers with full JSONPath", () => {
  const items = { items: [{ id: "1" }, { id: "22" }] };
  const contractWith = (matcher: {
    path: string;
    type: "by_regex" | "by_type" | "by_equality";
    value?: string;
  }): ParsedContract => makeContract({ body: items, matchers: { body: [matcher] } });

  it("should_apply_by_regex_to_every_element_of_a_wildcard_path", () => {
    const contract = contractWith({ path: "$.items[*].id", type: "by_regex", value: "[0-9]+" });
    expect(validateResponse(contract, makeResult({ body: items })).valid).toBe(true);
    const bad = { items: [{ id: "1" }, { id: "x" }] };
    expect(validateResponse(contract, makeResult({ body: bad })).valid).toBe(false);
  });

  it("should_fail_a_wildcard_matcher_that_selects_nothing", () => {
    const contract = contractWith({ path: "$.items[*].id", type: "by_regex", value: "[0-9]+" });
    expect(validateResponse(contract, makeResult({ body: { items: [] } })).valid).toBe(false);
  });

  it("should_resolve_bracket_and_index_paths", () => {
    const contract = contractWith({
      path: "$['items'][1].id",
      type: "by_regex",
      value: "[0-9]{2}",
    });
    expect(validateResponse(contract, makeResult({ body: items })).valid).toBe(true);
    const bad = { items: [{ id: "1" }, { id: "2" }] };
    expect(validateResponse(contract, makeResult({ body: bad })).valid).toBe(false);
  });

  it("should_check_by_type_on_each_element_against_the_contract", () => {
    const contract = contractWith({ path: "$.items[*].id", type: "by_type" });
    expect(validateResponse(contract, makeResult({ body: { items: [{ id: "a" }] } })).valid).toBe(
      true,
    );
    expect(validateResponse(contract, makeResult({ body: { items: [{ id: 1 }] } })).valid).toBe(
      false,
    );
  });

  it("should_compare_by_equality_on_a_wildcard_path_as_a_list", () => {
    const contract = contractWith({ path: "$.items[*].id", type: "by_equality" });
    expect(validateResponse(contract, makeResult({ body: items })).valid).toBe(true);
    const reordered = { items: [{ id: "22" }, { id: "1" }] };
    expect(validateResponse(contract, makeResult({ body: reordered })).valid).toBe(false);
  });

  it("should_report_an_invalid_path_as_a_failure", () => {
    const contract = contractWith({ path: "$.items[", type: "by_regex", value: ".*" });
    const result = validateResponse(contract, makeResult({ body: items }));
    expect(result.valid).toBe(false);
    expect(result.failures[0]?.actual).toContain("invalid JSONPath");
  });
});
