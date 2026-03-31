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
