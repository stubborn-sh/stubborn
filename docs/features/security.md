# Security

Role-based access control protecting all API endpoints. Supports HTTP Basic authentication
(for development and CI) and OAuth2/OIDC bearer tokens (for production).

## Roles

* **READER** — Read-only access to all GET endpoints
* **PUBLISHER** — Can publish contracts, record verifications and deployments
* **ADMIN** — Full access including application registration, webhook management, and cleanup

## Default Credentials

> **Warning:** The following credentials are provided for local development and testing only.
> **Change all default passwords before deploying to any shared or production environment.**

| Username  | Password  | Role      |
|-----------|-----------|-----------|
| admin     | admin     | ADMIN     |
| publisher | publisher | PUBLISHER |
| reader    | reader    | READER    |

## Role Matrix

| Endpoint Group                          | READER | PUBLISHER | ADMIN |
|-----------------------------------------|--------|-----------|-------|
| GET all resources (applications, contracts, verifications, deployments) | ✅ | ✅ | ✅ |
| POST applications (register new app)    | ❌     | ❌        | ✅    |
| POST contracts                          | ❌     | ✅        | ✅    |
| POST verifications                      | ❌     | ✅        | ✅    |
| POST deployments                        | ❌     | ✅        | ✅    |
| Can I Deploy queries (GET)              | ✅     | ✅        | ✅    |
| GET dependency graph / matrix           | ✅     | ✅        | ✅    |
| Webhook management (POST/PUT/DELETE)    | ❌     | ❌        | ✅    |
| Admin operations (user mgmt, cleanup, app deletion) | ❌ | ❌ | ✅ |

## Authentication

HTTP Basic authentication is always enabled for stateless API usage. CSRF is disabled.

### Public Endpoints

* `/actuator/health` and `/actuator/health/**` — Available without authentication

All other `/api/v1/**` endpoints require a valid role.

## Configuration

Configure security in `application.yml`:

```yaml
stubborn:
  broker:
    security:
      enabled: true
      users:
        - username: admin
          password: "{bcrypt}$2a$10$..."
          roles:
            - ADMIN
        - username: ci-publisher
          password: "{bcrypt}$2a$10$..."
          roles:
            - PUBLISHER
        - username: monitoring
          password: "{bcrypt}$2a$10$..."
          roles:
            - READER
```

Set `stubborn.broker.security.enabled: false` only in fully isolated local environments
where no network access is possible.

## OAuth2 / OIDC (Production)

For production deployments, configure an external identity provider so that the broker
validates bearer tokens instead of relying on in-memory Basic credentials:

```yaml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: https://your-identity-provider.com
```

Roles map to OAuth2 scopes as follows:

| Role      | OAuth2 Scope         |
|-----------|----------------------|
| READER    | `stubborn.reader`    |
| PUBLISHER | `stubborn.publisher` |
| ADMIN     | `stubborn.admin`     |

Assign the appropriate scope to each client in your identity provider.

## Recommended Service Account Roles

| Use Case              | Recommended Role |
|-----------------------|-----------------|
| CI pipeline (publish contracts, record verifications and deployments) | PUBLISHER |
| Monitoring / dashboards (read-only queries, can-i-deploy checks)      | READER    |
| Broker administration (user management, environment setup, cleanup)   | ADMIN     |

Prefer PUBLISHER for CI over ADMIN — it has exactly the permissions needed for a
publish-verify-deploy workflow without the ability to delete applications or manage webhooks.

## Error Responses

* `401 Unauthorized` — No credentials provided or credentials are invalid
* `403 Forbidden` — Valid credentials but the role lacks permission for the requested operation

See specification: [docs/specs/006-security.md](https://github.com/stubborn-sh/stubborn/blob/main/docs/specs/006-security.md)
