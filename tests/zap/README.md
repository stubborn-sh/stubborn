# OWASP ZAP Security Scanning

This directory contains configuration for OWASP ZAP security scans against the Stubborn broker.

## Automated Scans

A GitHub Actions workflow (`.github/workflows/zap-scan.yml`) runs a full ZAP scan:

- **Weekly** on Sundays at 2:00 AM UTC
- **On demand** via `workflow_dispatch`

Results are uploaded as a GitHub Actions artifact (`zap-report`).

## Running ZAP Locally

### Prerequisites

- Docker installed and running
- A running instance of the Stubborn broker (default: `http://localhost:8080`)

### Quick Start

Pull the ZAP Docker image:

```bash
docker pull ghcr.io/zaproxy/zaproxy:stable
```

Run a full scan against a local broker instance:

```bash
docker run --rm -v $(pwd)/tests/zap:/zap/wrk/:rw \
  --network host \
  ghcr.io/zaproxy/zaproxy:stable zap-full-scan.py \
  -t http://localhost:8080 \
  -c zap-rules.tsv \
  -a \
  -r zap-report.html
```

The HTML report will be written to `tests/zap/zap-report.html`.

### Scan Types

| Flag | Scan Type | Duration | Description |
|------|-----------|----------|-------------|
| `zap-baseline.py` | Baseline | ~1 min | Passive scan only, no active attacks |
| `zap-full-scan.py` | Full | ~15 min | Passive + active scanning |
| `zap-api-scan.py` | API | ~5 min | Targets OpenAPI/Swagger definitions |

For a faster feedback loop during development, use the baseline scan:

```bash
docker run --rm -v $(pwd)/tests/zap:/zap/wrk/:rw \
  --network host \
  ghcr.io/zaproxy/zaproxy:stable zap-baseline.py \
  -t http://localhost:8080 \
  -c zap-rules.tsv \
  -r zap-baseline-report.html
```

### Scan Against an OpenAPI Spec

If the broker exposes an OpenAPI endpoint, use the API scan for more targeted results:

```bash
docker run --rm -v $(pwd)/tests/zap:/zap/wrk/:rw \
  --network host \
  ghcr.io/zaproxy/zaproxy:stable zap-api-scan.py \
  -t http://localhost:8080/v3/api-docs \
  -f openapi \
  -c zap-rules.tsv \
  -r zap-api-report.html
```

## Rule Configuration

The `zap-rules.tsv` file controls which ZAP alert rules are suppressed. Each line contains:

```
<rule-id>\t<action>\t<rule-name>\t<justification>
```

Actions:
- `IGNORE` — suppress the alert entirely
- `WARN` — report but do not fail
- `FAIL` — treat as a failure

Edit `zap-rules.tsv` to adjust suppression as the broker evolves.
