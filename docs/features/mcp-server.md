# MCP Server

::: info ⭐ PRO Feature
The MCP Server is available in [Stubborn Pro](https://stubborn.sh/pro).
:::

The `broker-mcp-server` module exposes the broker API as an MCP (Model Context Protocol) server
for AI coding agents such as Claude Code, GitHub Copilot, and others.

See specification: [docs/specs/010-mcp-server.md](https://github.com/stubborn-sh/stubborn/blob/main/docs/specs/010-mcp-server.md)

## Overview

* 20 tools covering all broker operations
* 4 resources for reading broker state
* 4 prompts for guided workflows
* Runs on port 8643 (broker on 8642)
* Stateless mode with HTTP Basic authentication

## Getting Started

Add the MCP server to your AI agent's MCP configuration. The server exposes a standard
MCP endpoint on port 8643:

```json
{
  "mcpServers": {
    "stubborn-broker": {
      "command": "npx",
      "args": ["-y", "@stubborn-sh/mcp-server"],
      "env": {
        "BROKER_MCP_URL": "http://localhost:8642",
        "BROKER_MCP_USERNAME": "reader",
        "BROKER_MCP_PASSWORD": "your-password-here"
      }
    }
  }
}
```

Once connected, you can interact with the broker in natural language — for example:
_"Register order-service"_, _"Can I deploy v1.2.0 to staging?"_, or _"Show me the dependency graph."_

## Configuration

The MCP server connects to the broker REST API using HTTP Basic auth.
Configure via environment variables or application properties:

| Property | Default | Description |
|----------|---------|-------------|
| `broker.mcp.url` | `http://localhost:8642` | Broker REST API URL |
| `broker.mcp.username` | `reader` | Broker auth username |
| `broker.mcp.password` | `reader` | Broker auth password |
| `server.port` | `8643` | MCP server port |

## Security

Two built-in roles control access:

* **READER** — read-only tools and resources (list, get, query operations)
* **ADMIN** — all operations including writes (register, publish, record, delete)

Authentication uses HTTP Basic with in-memory users. Store credentials in environment
variables in production; do not hardcode them in configuration files.

## Available Tools

### Application Tools

| Tool Name | Description | Required Role |
|-----------|-------------|---------------|
| `list_applications` | List all applications (paginated, searchable) | READER |
| `get_application` | Get single application by name | READER |
| `register_application` | Register new application with name, owner, description | ADMIN |
| `delete_application` | Delete application and all related data | ADMIN |

### Contract Tools

| Tool Name | Description | Required Role |
|-----------|-------------|---------------|
| `list_contracts` | List contracts for an application version | READER |
| `publish_contract` | Publish a contract for an application version | ADMIN |

### Verification Tools

| Tool Name | Description | Required Role |
|-----------|-------------|---------------|
| `list_verifications` | List verification results (filterable by provider/consumer) | READER |
| `record_verification` | Record a verification result (SUCCESS/FAILED) | ADMIN |

### Deployment Tools

| Tool Name | Description | Required Role |
|-----------|-------------|---------------|
| `list_deployments` | List deployments in an environment | READER |
| `record_deployment` | Record deployment of an application version to an environment | ADMIN |

### Safety Tools

| Tool Name | Description | Required Role |
|-----------|-------------|---------------|
| `can_i_deploy` | Check if an application version is safe to deploy | READER |

### Graph Tools

| Tool Name | Description | Required Role |
|-----------|-------------|---------------|
| `get_dependency_graph` | Get full dependency graph (optional environment filter) | READER |
| `get_application_dependencies` | Get providers and consumers for a specific application | READER |

### Tag Tools

| Tool Name | Description | Required Role |
|-----------|-------------|---------------|
| `add_tag` | Add a tag to an application version | ADMIN |
| `remove_tag` | Remove a tag from an application version | ADMIN |
| `list_tags` | List all tags for a specific application version | READER |
| `get_latest_version_by_tag` | Get the latest version with a specific tag | READER |

### Selector Tools

| Tool Name | Description | Required Role |
|-----------|-------------|---------------|
| `resolve_selectors` | Resolve consumer version selectors to find contracts to verify | READER |

### Matrix Tools

| Tool Name | Description | Required Role |
|-----------|-------------|---------------|
| `query_matrix` | Query the compatibility matrix of provider-consumer verifications | READER |

### Cleanup Tools

| Tool Name | Description | Required Role |
|-----------|-------------|---------------|
| `run_cleanup` | Run data cleanup to remove old contract versions | ADMIN |

## Available Resources

Resources provide read-only snapshots of broker state and are accessible without tool invocation:

| URI | Description |
|-----|-------------|
| `broker://applications` | All registered applications |
| `broker://applications/{name}` | Single application details |
| `broker://applications/{name}/contracts/{version}` | Contracts for an application version |
| `broker://graph` | Full dependency graph |

## Available Prompts

Prompts return structured multi-step instructions that guide the AI agent through
complex broker operations:

| Prompt | Description |
|--------|-------------|
| `check-deployment-safety` | Step-by-step guide to verify deployment safety before releasing |
| `find-dependencies` | Analyze the dependency graph for a specific application |
| `publish-workflow` | Complete contract publishing workflow from start to finish |
| `environment-status` | Generate an environment health report |
