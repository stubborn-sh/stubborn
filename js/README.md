# Stubborn JS SDK

TypeScript/Node.js SDK monorepo for cross-language contract testing with the [Stubborn Broker](https://stubborn.sh).

## Packages

| Package | Description |
|---------|-------------|
| [`@stubborn-sh/broker-client`](packages/broker-client) | REST client for the Stubborn Broker API |
| [`@stubborn-sh/publisher`](packages/publisher) | Publishes contracts to the broker |
| [`@stubborn-sh/verifier`](packages/verifier) | Verifies provider contracts against the broker |
| [`@stubborn-sh/stub-server`](packages/stub-server) | Serves broker stubs for consumer testing |
| [`@stubborn-sh/stubs-packager`](packages/stubs-packager) | Packages stubs for distribution |
| [`@stubborn-sh/jest`](packages/jest) | Jest integration for contract tests |
| [`@stubborn-sh/cli`](packages/cli) | CLI for broker interactions |

## Install

```bash
# Broker client
npm install @stubborn-sh/broker-client

# Publisher (CI/CD integration)
npm install --save-dev @stubborn-sh/publisher

# Verifier
npm install --save-dev @stubborn-sh/verifier

# Stub server (consumer testing)
npm install --save-dev @stubborn-sh/stub-server

# CLI (global)
npm install -g @stubborn-sh/cli
```

## Verifying a Node producer in process

`ContractVerifier` fires each contract through an injectable `fetch`, so a
Node producer does not need a booted server on a real port — the app can be
driven directly, with its dependencies mocked at the boundary, in a plain unit
test. That mirrors the consumer side, where `setupStubs` already runs in
process.

For a handler that speaks WHATWG `Request`/`Response` — Hono, Elysia, Next
route handlers, `Bun.serve`, `Deno.serve` — no extra dependency is needed:

```js
import { ContractVerifier, fetchFromHandler } from "@stubborn-sh/verifier";

await new ContractVerifier({
  contractsDir,
  providerBaseUrl: "http://sut",
  fetch: fetchFromHandler(app.fetch),
}).verify();
```

For an Express-style app, drive it through supertest. It lives on its own entry
point because `supertest` is an optional peer dependency — install it yourself:

```js
import { ContractVerifier } from "@stubborn-sh/verifier";
import { fetchFromSupertest } from "@stubborn-sh/verifier/supertest";

await new ContractVerifier({
  contractsDir,
  providerBaseUrl: "http://sut",
  fetch: fetchFromSupertest(app),
}).verify();
```

`providerBaseUrl` is only used to build the URL the contract is fired at; with
either adapter nothing goes over the wire, so its host is arbitrary.

## Development

```bash
# Install all dependencies
npm install

# Build all packages
npm run build

# Run tests
npm test

# Lint
npm run lint
```

## Related

- [Main project README](../README.md)
- [Stubborn Broker](https://stubborn.sh)
- [Live demo](https://demo.stubborn.sh)
