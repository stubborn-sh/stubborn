import type { ParsedContract } from "@stubborn-sh/stub-server";
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
      const actualValue = getJsonPathValue(actual.body, matcher.path);

      let valid: boolean;
      switch (matcher.type) {
        case "by_regex":
          valid = byRegex(actualValue, matcher.value ?? ".*");
          break;
        case "by_type": {
          const expectedValue = getJsonPathValue(contract.response.body, matcher.path);
          valid = byType(actualValue, expectedValue);
          break;
        }
        case "by_equality": {
          const expectedValue = getJsonPathValue(contract.response.body, matcher.path);
          valid = byEquality(actualValue, expectedValue);
          break;
        }
        default:
          valid = false;
      }

      if (!valid) {
        failures.push({
          field: `body${matcher.path}`,
          expected: `${matcher.type}(${matcher.value ?? ""})`,
          actual: JSON.stringify(actualValue),
        });
      }
    }
  }

  return {
    valid: failures.length === 0,
    contractName: contract.name,
    failures,
  };
}

/**
 * Simple JSONPath-like value extractor. Supports `$.field.nested` syntax.
 */
function getJsonPathValue(obj: unknown, path: string): unknown {
  if (typeof obj !== "object" || obj === null) {
    return undefined;
  }

  // Strip leading "$." prefix
  const cleanPath = path.startsWith("$.") ? path.slice(2) : path;
  const parts = cleanPath.split(".");

  let current: unknown = obj;
  for (const part of parts) {
    if (typeof current !== "object" || current === null) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}
