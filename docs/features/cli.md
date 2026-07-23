# CLI

The Stubborn broker ships with an npm CLI (`@stubborn-sh/cli`) for interacting with the broker from the terminal.

## Installation

```bash
npm install -g @stubborn-sh/cli
```

## Global Options

* `--broker-url` -- broker base URL (default: `http://localhost:8642`, env: `SCC_BROKER_URL`)
* `--username` -- HTTP Basic username (env: `SCC_BROKER_USERNAME`)
* `--password` -- HTTP Basic password (env: `SCC_BROKER_PASSWORD`)
* `--output` -- output format: `table` (default) or `json`

## Commands

| Command | Description |
| --- | --- |
| `app list\|get\|register\|delete` | Manage applications |
| `contract list\|get\|publish\|delete` | Manage contracts |
| `verify record\|list` | Record and list verifications |
| `deploy record\|list\|get` | Record and list deployments |
| `can-i-deploy --app --version --env` | Check deployment safety |
| `env list\|get\|create\|update\|delete` | Manage environments |
| `graph show\|app` | View dependency graph |
| `matrix query` | Query compatibility matrix |
| `tag add\|remove\|list\|latest` | Manage version tags |
| `webhook list\|get\|create\|update\|delete\|executions` | Manage webhooks |
| `selector resolve` | Resolve consumer version selectors |
| `cleanup` | Run data cleanup |
| `version` | Show CLI version |

## Examples

```bash
# List applications
stubborn app list

# Check deployment safety
stubborn can-i-deploy --app order-service --version 1.0.0 --env staging

# List webhooks in JSON format
stubborn --output json webhook list
```

::: tip PRO: Enhanced Java CLI
[Stubborn Pro](https://stubborn.sh/pro) includes a full-featured Java/Picocli CLI with richer table output, offline support, and additional commands.
:::
