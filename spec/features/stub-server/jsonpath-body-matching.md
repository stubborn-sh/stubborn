---
feature: stub-server-jsonpath-body-matching
status: implemented
tests:
  - js/packages/stub-server/tests/unit/generated-jsonpath-matching.test.ts
  - js/packages/stub-server/tests/unit/adversarial-qa.test.ts
  - js/packages/stub-server/tests/unit/body-pattern-matching.test.ts
---

# JS Stub Server — `matchesJsonPath` body matching

## Summary

WireMock mappings produced by the contract converter express request-body
expectations as `bodyPatterns[].matchesJsonPath` expressions, including
filters nested under array wildcards (e.g. `$.items[*][?(@.id == '1')]`,
`$.order.lines[*].parts[*][?(@.code == 'p1')]`). The JS stub server must
evaluate these the way WireMock 3.x (Jayway JsonPath) does, so a stub that
matches in WireMock also matches in the JS stub server, and vice versa.

## Acceptance Criteria

### AC-JP-1: Generated mappings match their own contract's request

- For every mapping produced by the converter, sending the request body from
  the originating contract matches the mapping.
- The stub server answers the mapping's response (not 404) for that request.

### AC-JP-2: Filters under `[*]` are evaluated, not skipped

- A filter nested under one or more `[*]` wildcards matches when at least one
  element at that depth satisfies it, and does not match otherwise.
- Element order and extra elements do not affect the result.
- `=~` regex filters must fully match the value.
- `size()` constraints on arrays are honoured.

### AC-JP-3: Results agree with WireMock 3.13.2

- An existence expression (`$.x`) does not match when the value is `null`,
  an empty object or an empty array.
- A JSONPath expression the evaluator cannot parse does not match (previously
  it was treated as a pass).
- `==` compares a number with a numeric string by numeric value.

## Scope

- In scope: `matchesJsonPath` in request body patterns of the JS stub server.
- Out of scope: `matchesJsonPath` with nested `equalTo`/`contains` sub-matchers,
  JSONPath functions other than `size()`/`length()`.
