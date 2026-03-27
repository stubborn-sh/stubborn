# Stubborn Broker Load Tests

k6 load tests for the Stubborn broker API.

## Prerequisites

- [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/) installed
- Stubborn broker running (default: `http://localhost:8642`)
- Default credentials: `admin:admin`

## Running

Start the broker locally, then run individual scripts:

```bash
# Contract publishing (50 VUs, 2 min ramp)
k6 run tests/load/contract-publish-load.js

# Can-I-Deploy queries (100 VUs, 2 min ramp, read-heavy)
k6 run tests/load/can-i-deploy-load.js

# Webhook dispatch under load (20 VUs, 1 min)
k6 run tests/load/webhook-dispatch-load.js
```

## Configuration

Override defaults via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `BROKER_URL` | `http://localhost:8642` | Broker base URL |
| `BROKER_USER` | `admin` | HTTP Basic auth username |
| `BROKER_PASS` | `admin` | HTTP Basic auth password |

Example:

```bash
k6 run -e BROKER_URL=https://broker.example.com -e BROKER_USER=myuser -e BROKER_PASS=secret \
  tests/load/contract-publish-load.js
```

## Thresholds

| Script | p95 Latency | Error Rate |
|--------|-------------|------------|
| `contract-publish-load.js` | < 500ms | < 1% |
| `can-i-deploy-load.js` | < 200ms | < 0.1% |
| `webhook-dispatch-load.js` | < 1s | < 1% |

## Output

k6 prints a summary to stdout by default. For JSON output:

```bash
k6 run --out json=results.json tests/load/contract-publish-load.js
```

The GitHub Actions workflow uploads the summary as a build artifact.
