---
feature: openapi-contract-support
status: in-progress
tests:
  - js/packages/stub-server/tests/unit/openapi-parser.test.ts
  - js/packages/stub-server/tests/unit/directory-loader.test.ts
  - js/packages/verifier/tests/unit/contract-loader.test.ts
  - js/packages/stubs-packager/tests/unit/contract-to-wiremock.test.ts
---

# Feature 042: OpenAPI Contract Support in JS SDK

## What

Parse OpenAPI 3.x specifications containing `x-contracts` vendor extensions into
`ParsedContract` objects within the stubborn JS SDK. This enables the same contract
format supported by `stubborn-openapi` (Java) to work across all JS SDK pipelines:
stub serving, verification, and stubs packaging.

## Who

- Teams that maintain an OpenAPI spec as their source of truth and embed contract
  examples via `x-contracts` extensions
- JS/TS consumers who publish OpenAPI-based contracts to the Stubborn broker

## Why

The Java `stubborn-openapi` library already supports converting OpenAPI 3.x specs
with `x-contracts` into Spring Cloud Contract objects. The JS SDK currently only
understands SCC YAML and WireMock JSON. Teams using the JS toolchain cannot consume
OpenAPI-based contracts without a manual conversion step.

## How (High Level)

A new `openapi-parser.ts` module in `@stubborn-sh/stub-server` converts OpenAPI
specs into `ParsedContract[]` — the same type every downstream consumer already uses.
Content sniffing (checking if the first non-comment line starts with `openapi` or
`swagger`) distinguishes OpenAPI YAML from SCC YAML. No new npm dependencies are
required; `js-yaml` parses the document, and we walk the raw object tree.

## x-contracts Extension Convention

Follows the same convention as the Java `stubborn-openapi` library. Example:

```yaml
openapi: 3.0.0
info:
  title: My Service
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
          content:
            application/json: {}
          x-contracts:
            - contractId: 1
              body: '{"id": 123, "name": "John"}'
              headers:
                Content-Type: application/json
```

### Contract Properties from x-contracts

| Property | Source | Description |
|----------|--------|-------------|
| `name` | `operation.x-contracts[].name` | Contract name |
| `contractId` | `operation.x-contracts[].contractId` | Correlates operation/param/response entries |
| `contractPath` | `operation.x-contracts[].contractPath` | Override URL path |
| `priority` | `operation.x-contracts[].priority` | WireMock priority |
| `ignored` | `operation.x-contracts[].ignored` | Skip this contract |
| `headers` | `operation.x-contracts[].headers` | Request headers |
| `queryParameters` | `operation.x-contracts[].request.queryParameters` | Query params |

## Business Rules

1. Only operations with `x-contracts` extensions are converted; others are skipped
2. Each `x-contracts` entry produces one `ParsedContract`, keyed by `contractId`
3. HTTP method is derived from the operation's position on the path item (get/post/put/delete/patch)
4. URL path defaults to the OpenAPI path with `{param}` placeholders replaced by `x-contracts` values from parameter-level extensions matching the same `contractId`
5. `contractPath` in the operation extension overrides the calculated path
6. Request headers merge from: operation-level `x-contracts.headers` and request body content type
7. Query parameters come from query-type parameter `x-contracts` with matching `contractId`
8. Request body comes from request body `x-contracts` with matching `contractId`
9. Response status is parsed from the OpenAPI response key (e.g., `"200"` → 200)
10. Response body and headers come from response-level `x-contracts` with matching `contractId`
11. Response Content-Type is derived from the OpenAPI response content media type
12. Contracts with `ignored: true` are excluded from output
13. Files are identified as OpenAPI by content sniffing: first non-comment, non-blank line starts with `openapi`, `swagger`, `"openapi"`, `"swagger"`, or `{`
14. Non-OpenAPI YAML files are not affected — they continue through the SCC YAML parser

## Integration Points

| Component | Change | Impact |
|-----------|--------|--------|
| `stub-server/directory-loader` | Content-sniff `.yaml`/`.yml` files; route OpenAPI to new parser | One file can now produce multiple `ParsedContract`s |
| `verifier/contract-loader` | Accept OpenAPI content from broker (sniff `application/x-yaml` content) | Verifier can verify OpenAPI-based contracts |
| `stubs-packager/contract-to-wiremock` | Convert OpenAPI content to multiple WireMock mappings | Packager produces correct stubs from OpenAPI input |
| `stub-server/index` | Export `parseOpenApiContracts` and `looksLikeOpenApi` | Public API for direct use |

The publisher needs no changes — it ships raw bytes with `application/x-yaml`.

## Acceptance Criteria

### AC1: Basic GET Conversion

**Given** an OpenAPI spec with `GET /v1/events` and `x-contracts` with `contractId: 200`
**And** a query parameter with `x-contracts` value `"2022-04-13"` for `contractId: 200`
**And** a `200` response with `x-contracts` containing a body
**When** `parseOpenApiContracts` processes the spec
**Then** one `ParsedContract` is produced with method `GET`, query parameter `date=2022-04-13`, and status `200` with the response body

### AC2: Multiple Contracts Per Operation

**Given** an OpenAPI operation with three `x-contracts` entries (contractId 200, 400, 500)
**And** corresponding parameter and response `x-contracts` for all three IDs
**When** `parseOpenApiContracts` processes the spec
**Then** three separate `ParsedContract` objects are produced, each with the correct status code

### AC3: POST with Request Body

**Given** an OpenAPI spec with `POST /users` and a request body with `x-contracts` containing `body: '{"name":"John"}'`
**And** the request content type is `application/json`
**When** the parser processes the spec
**Then** the contract has Content-Type header `application/json` and the specified body

### AC4: Path Parameter Substitution

**Given** an OpenAPI path `/users/{id}` with a path parameter `x-contracts` value `"123"` for `contractId: 1`
**When** the parser processes the spec
**Then** the contract URL path is `/users/123`

### AC5: contractPath Override

**Given** an OpenAPI operation with `x-contracts` containing `contractPath: "/custom/path"`
**When** the parser processes the spec
**Then** the contract URL path is `/custom/path` (not the OpenAPI path)

### AC6: Non-OpenAPI YAML Unaffected

**Given** a standard SCC YAML contract file (starts with `request:`)
**When** `looksLikeOpenApi` checks the content
**Then** it returns `false` and the file is parsed by the existing SCC parser

### AC7: Directory Loader Mixed Formats

**Given** a directory containing both SCC YAML and OpenAPI YAML files
**When** `loadFromDirectory` processes the directory
**Then** all contracts from both formats are returned as `ParsedContract[]`

### AC8: Ignored Contracts Excluded

**Given** an OpenAPI `x-contracts` entry with `ignored: true`
**When** the parser processes the spec
**Then** that entry is not included in the output

### AC9: No x-contracts Produces Empty

**Given** an OpenAPI spec with operations but no `x-contracts` extensions
**When** the parser processes the spec
**Then** an empty array is returned

### AC10: Verifier Loads from Broker

**Given** the broker returns a contract with content type `application/x-yaml` whose content is an OpenAPI spec
**When** `loadFromBroker` processes it
**Then** the OpenAPI content is parsed into `ParsedContract[]` via the OpenAPI parser

### AC11: Stubs Packager Converts OpenAPI

**Given** a scanned contract whose content is an OpenAPI spec with `x-contracts`
**When** the stubs packager converts it to WireMock
**Then** one WireMock JSON mapping is produced per `x-contracts` entry

## Error Cases

| Scenario | Behavior |
|----------|----------|
| OpenAPI spec has no `paths` | Returns empty array |
| Operations have no `x-contracts` | Returns empty array |
| `contractId` in parameter has no matching operation entry | Parameter is ignored for that contract |
| Response key is not a valid number | Contract is skipped |
| Malformed YAML | Throws with descriptive error message |

## Out of Scope

- `convertTo` (Contract → OpenAPI) — not supported, matches Java library
- Matchers (`regex`, `predefined`, `command`) — deferred to a follow-up
- Multipart request support — deferred to a follow-up
- Cookie support — deferred to a follow-up
- `serviceName` filtering — deferred to a follow-up
- New MIME type registration — reuse existing `application/x-yaml`
