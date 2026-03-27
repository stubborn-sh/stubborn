# Feature 30: Webhook Timeout

## What

Configure explicit connect and read timeouts on the HTTP client used by
`WebhookDispatcher` to deliver webhook callbacks.

- **Connect timeout**: 5 seconds
- **Read timeout**: 15 seconds

## Why

Without explicit timeouts the webhook `RestClient` inherits JDK defaults which
are either infinite or very long (several minutes). A slow or unresponsive
webhook endpoint can block the dispatcher thread indefinitely, exhaust the async
thread pool, and prevent delivery to other registered webhooks. Explicit timeouts
ensure the broker fails fast and proceeds with retry or failure recording.

## How (High Level)

Create a `JdkClientHttpRequestFactory` (or equivalent) with a
`java.net.http.HttpClient` whose connect timeout is set to 5 seconds. Set the
read timeout on the request factory to 15 seconds. Pass this factory to
`RestClient.Builder.requestFactory(...)` inside `WebhookDispatcher`.

## Acceptance Criteria

### AC-1: Connect timeout is configured

**Given** a webhook subscription pointing to an unreachable host
**When** the broker attempts to deliver an event
**Then** the connection attempt fails within approximately 5 seconds
**And** the failure is recorded as a `WebhookExecution` with an error message

### AC-2: Read timeout is configured

**Given** a webhook subscription pointing to a server that accepts the
connection but does not respond within 15 seconds
**When** the broker attempts to deliver an event
**Then** the read times out within approximately 15 seconds
**And** the failure is recorded as a `WebhookExecution` with an error message

### AC-3: Successful delivery still works

**Given** a webhook subscription pointing to a responsive server
**When** the broker delivers an event
**Then** the delivery succeeds as before (no regression)
