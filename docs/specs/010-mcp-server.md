# Feature 10: MCP Server

## What

The MCP (Model Context Protocol) server exposes the broker API as tools, resources,
and prompts for AI agents. It enables Claude and other AI assistants to interact with
the broker through structured tool calls rather than raw HTTP requests.

## Why

AI-powered development tools (Claude Code, Copilot, Codex) need structured access to
contract management operations:
- Register applications and publish contracts as part of AI-assisted development
- Check deployment safety before AI-suggested deployments
- Query the dependency graph to understand service relationships
- Follow guided workflows for complex multi-step operations

The MCP server translates broker REST API operations into the MCP protocol that AI
agents understand natively.

## How (High Level)

A separate Spring Boot application connects to the broker via its REST API using HTTP
Basic auth. It exposes 20 tools (CRUD operations), 4 resources (read-only state), and
4 prompts (guided workflows) through the Spring AI MCP server framework.

## Architecture

```
AI Agent (Claude) <--MCP protocol--> MCP Server (port 8643) <--REST/HTTP Basic--> Broker (port 8642)
```

The MCP server is stateless. All state lives in the broker. Authentication to the broker
uses configurable HTTP Basic credentials.

## Tools (20)

### Application Tools
| Tool | Description |
|------|-------------|
| `list_applications` | List all applications (paginated, searchable) |
| `get_application` | Get single application by name |
| `register_application` | Register new application with name, owner, description |
| `delete_application` | Delete application and all related data |

### Contract Tools
| Tool | Description |
|------|-------------|
| `list_contracts` | List contracts for application version |
| `publish_contract` | Publish contract for application version |

### Verification Tools
| Tool | Description |
|------|-------------|
| `list_verifications` | List verification results (filterable by provider/consumer) |
| `record_verification` | Record verification result (SUCCESS/FAILED) |

### Deployment Tools
| Tool | Description |
|------|-------------|
| `list_deployments` | List deployments in environment |
| `record_deployment` | Record deployment of application version to environment |

### Safety Tools
| Tool | Description |
|------|-------------|
| `can_i_deploy` | Check if application version is safe to deploy |

### Graph Tools
| Tool | Description |
|------|-------------|
| `get_dependency_graph` | Get full dependency graph (optional environment filter) |
| `get_application_dependencies` | Get providers and consumers for specific application |

### Tag Tools
| Tool | Description |
|------|-------------|
| `add_tag` | Add a tag to an application version |
| `remove_tag` | Remove a tag from an application version |
| `list_tags` | List all tags for a specific application version |
| `get_latest_version_by_tag` | Get the latest version with a specific tag |

### Selector Tools
| Tool | Description |
|------|-------------|
| `resolve_selectors` | Resolve consumer version selectors to find contracts to verify |

### Matrix Tools
| Tool | Description |
|------|-------------|
| `query_matrix` | Query compatibility matrix of provider-consumer verifications |

### Cleanup Tools
| Tool | Description |
|------|-------------|
| `run_cleanup` | Run data cleanup to remove old contract versions |

## Resources (4)

| URI | Description |
|-----|-------------|
| `broker://applications` | All registered applications |
| `broker://applications/{name}` | Single application details |
| `broker://applications/{name}/contracts/{version}` | Contracts for application version |
| `broker://graph` | Full dependency graph |

Resources provide read-only snapshots of broker state, accessible without tool invocation.

## Prompts (4)

| Prompt | Description |
|--------|-------------|
| `check-deployment-safety` | Step-by-step guide to verify deployment safety |
| `find-dependencies` | Analyze dependency graph for an application |
| `publish-workflow` | Complete contract publishing workflow |
| `environment-status` | Generate environment health report |

Prompts return structured multi-step instructions that guide the AI agent through
complex broker operations.

## Business Rules

1. MCP server requires HTTP Basic authentication (separate from broker auth)
2. Two built-in roles: READER (read-only tools/resources) and ADMIN (all operations)
3. All tool calls are synchronous (MCP server type: SYNC)
4. Tool errors are translated to human-readable messages (not raw HTTP errors)
5. Resource URIs use `broker://` scheme for namespacing
6. Prompt parameters are validated before generating workflow instructions

## Security

- HTTP Basic auth with in-memory users (configurable via properties)
- CSRF disabled (stateless API)
- Stateless session management
- Broker credentials stored in application configuration (env vars in production)

## Configuration

| Property | Default | Description |
|----------|---------|-------------|
| `broker.mcp.url` | `http://localhost:8642` | Broker REST API URL |
| `broker.mcp.username` | `reader` | Broker auth username |
| `broker.mcp.password` | `reader` | Broker auth password |
| `server.port` | `8643` | MCP server port |

## Error Cases

| Scenario | Behavior |
|----------|----------|
| Broker unreachable | BrokerConnectionException with descriptive message |
| Application not found | BrokerNotFoundException |
| Duplicate resource | BrokerConflictException |
| Invalid tool parameters | Validation error returned to AI agent |
