# Feature 13: Event Webhooks

## What

Webhook subscriptions allow external systems to receive HTTP callbacks when broker
events occur. Users register webhook URLs with optional event type and application
filters, and the broker delivers event payloads asynchronously with retry logic.
Execution history is tracked for debugging and auditing.

## Why

Without webhooks, teams cannot:
- Trigger CI/CD pipelines automatically when new contracts are published
- Alert Slack or Teams channels when a verification fails
- Integrate the broker with external governance or compliance tools
- Build automated workflows that react to contract lifecycle events

Webhooks enable the broker to participate in event-driven architectures without
requiring consumers to poll for changes.

## How (High Level)

Users register webhook subscriptions via the API, specifying a callback URL, the events
they want to receive, and optionally scoping to a specific application. When a matching
event occurs, the broker sends an HTTP POST to the callback URL with a JSON payload
describing the event. Delivery is asynchronous with exponential backoff retry on failure.
Each delivery attempt is recorded as an execution for auditing.

## API

```
POST   /api/v1/webhooks                    -> 201 Created
GET    /api/v1/webhooks                    -> 200 OK (paginated, searchable)
GET    /api/v1/webhooks/{id}               -> 200 OK
PUT    /api/v1/webhooks/{id}               -> 200 OK (update)
DELETE /api/v1/webhooks/{id}               -> 204 No Content
GET    /api/v1/webhooks/{id}/executions    -> 200 OK (delivery history)
```

### Query Parameters (List)

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `search` | string | - | Case-insensitive filter on webhook URL |
| `page` | int | 0 | Zero-indexed page number |
| `size` | int | 20 | Page size |
| `sort` | string | `createdAt,desc` | Sort field and direction |

### Request: Create Webhook

```json
{
    "url": "https://ci.example.com/webhook",
    "events": ["CONTRACT_PUBLISHED", "VERIFICATION_FAILED"],
    "applicationName": "order-service",
    "bodyTemplate": "{\"text\": \"${event} for ${applicationName} ${version}\"}",
    "headers": {
        "Authorization": "Bearer secret-token"
    }
}
```

### Response: Webhook

```json
{
    "id": "...",
    "url": "https://ci.example.com/webhook",
    "events": ["CONTRACT_PUBLISHED", "VERIFICATION_FAILED"],
    "applicationName": "order-service",
    "bodyTemplate": "{\"text\": \"${event} for ${applicationName} ${version}\"}",
    "enabled": true,
    "createdAt": "2026-01-15T10:30:00Z"
}
```

### Response: Execution History

```json
{
    "content": [
        {
            "id": "...",
            "webhookId": "...",
            "event": "CONTRACT_PUBLISHED",
            "requestUrl": "https://ci.example.com/webhook",
            "requestBody": "{\"text\": \"CONTRACT_PUBLISHED for order-service 1.0.0\"}",
            "responseStatus": 200,
            "success": true,
            "attemptNumber": 1,
            "executedAt": "2026-01-15T10:30:05Z"
        }
    ]
}
```

## Supported Events

| Event | Trigger |
|-------|---------|
| `CONTRACT_PUBLISHED` | A new contract version is published |
| `VERIFICATION_PUBLISHED` | A verification result is recorded (any status) |
| `VERIFICATION_SUCCEEDED` | A verification result with status SUCCESS is recorded |
| `VERIFICATION_FAILED` | A verification result with status FAILED is recorded |
| `DEPLOYMENT_RECORDED` | A deployment to an environment is recorded |

### Event Payloads

When no `bodyTemplate` is specified, the broker sends a default JSON payload containing
all relevant fields for the event. Available fields vary by event type:

| Field | CONTRACT_PUBLISHED | VERIFICATION_* | DEPLOYMENT_RECORDED |
|-------|--------------------|-----------------|---------------------|
| `event` | Yes | Yes | Yes |
| `timestamp` | Yes | Yes | Yes |
| `applicationName` | Yes | Yes (provider) | Yes |
| `version` | Yes | Yes (provider) | Yes |
| `consumerName` | - | Yes | - |
| `consumerVersion` | - | Yes | - |
| `providerName` | - | Yes | - |
| `providerVersion` | - | Yes | - |
| `status` | - | Yes (SUCCESS/FAILED) | - |
| `environment` | - | - | Yes |

Fields not applicable to an event are omitted from the payload (not sent as null).

## Business Rules

1. The `url` field must be a valid HTTPS URL
2. The `events` array must contain at least one valid event type
3. The `applicationName` field is optional; when omitted, the webhook fires for all applications
4. The `bodyTemplate` field is optional; when omitted, the broker sends a default JSON payload with full event details
5. Template variables use `${variable}` syntax; available variables include: `event`, `applicationName`, `version`, `consumerName`, `consumerVersion`, `providerName`, `providerVersion`, `environment`, `status`, `timestamp`
6. Unresolved template variables are replaced with empty strings
7. Custom `headers` are sent with each callback request
8. Delivery is asynchronous; the triggering API call returns immediately
9. Failed deliveries are retried up to 3 times with exponential backoff (1s, 5s, 25s)
10. A delivery is considered failed if the response status is not 2xx or the request times out (10s)
11. Execution history is retained for 30 days
12. Webhooks can be enabled or disabled without deletion
13. Deleting a webhook stops all future deliveries but retains execution history

## Acceptance Criteria

### Register Webhook

**Given** I am authenticated as an ADMIN
**When** I POST `/api/v1/webhooks` with url "https://ci.example.com/hook" and events ["CONTRACT_PUBLISHED"]
**Then** I receive 201 Created
**And** the response includes the webhook with `enabled` true

### Webhook Fires on Event

**Given** a webhook exists for event "CONTRACT_PUBLISHED" scoped to "order-service"
**When** a contract is published for "order-service" version "1.0.0"
**Then** the webhook URL receives an HTTP POST with the event payload

### Webhook Does Not Fire for Unscoped Application

**Given** a webhook exists for event "CONTRACT_PUBLISHED" scoped to "order-service"
**When** a contract is published for "payment-service" version "1.0.0"
**Then** the webhook URL does not receive a callback

### Template Variable Substitution

**Given** a webhook exists with bodyTemplate "{\"msg\": \"${event} for ${applicationName}\"}"
**When** a CONTRACT_PUBLISHED event fires for "order-service"
**Then** the callback body is "{\"msg\": \"CONTRACT_PUBLISHED for order-service\"}"

### Execution History

**Given** a webhook has fired 3 times
**When** I GET `/api/v1/webhooks/{id}/executions`
**Then** I receive 200 OK
**And** the response contains 3 execution records with status and timestamps

### Retry on Failure

**Given** a webhook exists with a callback URL that returns 500
**When** a matching event fires
**Then** the broker retries delivery up to 3 times with exponential backoff
**And** execution history records each attempt

### Delete Webhook

**Given** a webhook exists
**When** I DELETE `/api/v1/webhooks/{id}`
**Then** I receive 204 No Content
**And** no future events trigger this webhook

## Error Cases

| Scenario | HTTP Status | Error Code |
|----------|-------------|------------|
| Invalid URL (not HTTPS) | 400 | VALIDATION_ERROR |
| Empty events array | 400 | VALIDATION_ERROR |
| Unknown event type | 400 | VALIDATION_ERROR |
| Webhook not found | 404 | WEBHOOK_NOT_FOUND |
| Unauthorized (not ADMIN) | 403 | FORBIDDEN |
