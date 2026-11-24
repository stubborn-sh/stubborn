import { evaluateJsonPath, type BodyMatcher, type ParsedContract } from "@stubborn-sh/stub-server";
import type { ExecutionResult } from "./request-executor.js";
import { byRegex, byType, byEquality } from "./matchers.js";

/** Validation failure detail. */
export interface ValidationFailure {
  readonly field: string;
  readonly expected: string;
  readonly actual: string;
}

/** Result of validating a response against a contract. */
export interface ValidationResult {
  readonly valid: boolean;
  readonly contractName: string;
  readonly failures: readonly ValidationFailure[];
}

/**
 * Validate an actual HTTP response against a contract's expected response.
 */
export function validateResponse(
  contract: ParsedContract,
  actual: ExecutionResult,
): ValidationResult {
  const failures: ValidationFailure[] = [];

  // Validate status
  if (actual.status !== contract.response.status) {
    failures.push({
      field: "status",
      expected: String(contract.response.status),
      actual: String(actual.status),
    });
  }

  // Validate headers
  if (contract.response.headers !== undefined) {
    for (const [key, expectedValue] of Object.entries(contract.response.headers)) {
      const actualValue = Object.entries(actual.headers).find(
        ([k]) => k.toLowerCase() === key.toLowerCase(),
      )?.[1];
      if (actualValue === undefined) {
        failures.push({
          field: `header[${key}]`,
          expected: expectedValue,
          actual: "(missing)",
        });
      } else if (actualValue !== expectedValue) {
        failures.push({
          field: `header[${key}]`,
          expected: expectedValue,
          actual: actualValue,
        });
      }
    }
  }

  // Validate body (without matchers — plain deep equality)
  if (
    contract.response.body !== undefined &&
    (contract.response.matchers === undefined || contract.response.matchers.body === undefined)
  ) {
    if (!byEquality(actual.body, contract.response.body)) {
      failures.push({
        field: "body",
        expected: JSON.stringify(contract.response.body),
        actual: JSON.stringify(actual.body),
      });
    }
  }

  // Validate body with matchers
  if (contract.response.matchers?.body !== undefined) {
    for (const matcher of contract.response.matchers.body) {
      const failure = validateMatcher(matcher, actual.body, contract.response.body);
      if (failure !== undefined) failures.push(failure);
    }
  }

  return {
    valid: failures.length === 0,
    contractName: contract.name,
    failures,
  };
}

/**
 * Check one body matcher. The path is full JSONPath; a path selecting several values (`[*]`,
 * filters, deep scan) must select at least one, and every selected value must satisfy the
 * matcher — as the Java verifier's `allElementsMatch`.
 */
function validateMatcher(
  matcher: BodyMatcher,
  actualBody: unknown,
  contractBody: unknown,
): ValidationFailure | undefined {
  const expected = `${matcher.type}(${matcher.value ?? ""})`;
  let actual: ReturnType<typeof evaluateJsonPath>;
  let reference: ReturnType<typeof evaluateJsonPath>;
  try {
    actual = evaluateJsonPath(actualBody, matcher.path);
    reference = evaluateJsonPath(contractBody, matcher.path);
  } catch (err: unknown) {
    return {
      field: `body${matcher.path}`,
      expected,
      actual: `invalid JSONPath: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const describe = (): string =>
    JSON.stringify(actual.definite ? actual.values[0] : actual.values) ?? "undefined";
  const fail: ValidationFailure = { field: `body${matcher.path}`, expected, actual: describe() };

  if (matcher.type === "by_equality") {
    const want = reference.definite ? reference.values[0] : reference.values;
    const got = actual.definite ? actual.values[0] : actual.values;
    return byEquality(got, want) ? undefined : fail;
  }

  if (actual.values.length === 0) return fail;
  const ok = actual.values.every((value, i) => {
    if (matcher.type === "by_regex") return byRegex(value, matcher.value ?? ".*");
    if (matcher.type === "by_type") {
      // Each selected value must have the type of the contract's value at that position.
      return byType(value, reference.values[Math.min(i, reference.values.length - 1)]);
    }
    return false;
  });
  return ok ? undefined : fail;
}
