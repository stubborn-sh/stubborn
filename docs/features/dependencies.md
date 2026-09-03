# Dependencies

A consumer can state which providers it depends on, instead of the broker inferring the
relationship after the fact.

## Why declare anything?

Until a consumer declares a dependency, the only evidence that it consumes a provider is a
recorded **verification**. That evidence is retrospective, which leaves a gap: a consumer
that has been deployed but has never verified against the provider is indistinguishable
from an unrelated application that merely shares the environment. `can-i-deploy` therefore
cannot evaluate it, and reports the provider as safe to deploy.

Messaging has never had this problem — a messaging contract records its topics and their
direction (`PUBLISH` / `SUBSCRIBE`) when it is published, so the dependency is known up
front. Declaring a dependency gives HTTP consumers the same footing.

Note that in this broker **the provider publishes contracts** — they are the provider's
stubs, which consumers resolve. A provider therefore cannot name its own consumers, which
is why the declaration is made by the consumer.

## Declaring a dependency

The path identifies the **consumer** and the version the dependency belongs to; the body
names the provider.

```bash
curl -u admin:admin -X POST \
  http://localhost:8080/api/v1/applications/payment-service/versions/2.0.0/dependencies \
  -H 'Content-Type: application/json' \
  -d '{"provider": "order-service"}'
```

```json
{
  "consumer": "payment-service",
  "consumerVersion": "2.0.0",
  "provider": "order-service",
  "source": "DECLARED",
  "declaredAt": "2026-09-03T12:00:00Z"
}
```

Declaring is idempotent: re-declaring an existing dependency returns the stored one and
creates no second row. `source` therefore records how the dependency was **first** learned
of, not how it was last confirmed.

An application cannot depend on itself; that returns `400 Bad Request`.

List what a consumer version depends on:

```bash
curl -u admin:admin \
  http://localhost:8080/api/v1/applications/payment-service/versions/2.0.0/dependencies
```

## Automatic recording

Most consumers never need to call the endpoint. When the stub runner resolves a provider's
stubs from the broker, it records the dependency itself, with `source: STUB_DOWNLOAD` —
the consumer is already telling the broker which provider it depends on simply by asking
for its stubs.

This needs the consumer's own identity, which is not otherwise required to download stubs:

```properties
stubborn.contract.stubrunner.consumer.name=payment-service
stubborn.contract.stubrunner.consumer.version=2.0.0
```

Without both properties the recording is skipped and stub resolution proceeds unchanged.
Recording is strictly best effort: if the broker is unreachable or rejects the call, it is
logged at debug and the stubs still resolve. Downloading stubs is what the caller asked
for, and it does not fail because a bookkeeping call did.

## Effect on Can I Deploy

`can-i-deploy` treats an application as a known consumer of a provider if it has declared a
dependency on it **or** has verified against it at least once. See
[Can I Deploy](./can-i-deploy.md) for the full rules.
