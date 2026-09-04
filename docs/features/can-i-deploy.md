# Can I Deploy

Safety gate: determine if it is safe to deploy a specific version to an environment.

## Overview

The Can I Deploy check answers: "If I deploy version X of application A to environment E,
will A and everything already running in E still talk to each other?"

That question has two halves, and the check answers both:

**A as a provider** — the applications deployed in the target environment that are **known
consumers** of A:

1. Find the applications deployed in E that are known consumers of A
2. For each, check that a successful verification exists against version X

**A as a consumer** — the applications deployed in the target environment that A itself calls:

1. Find the applications deployed in E that are known providers of A
2. For each, check that version X has a successful verification against the version of that
   provider currently deployed to E

Both halves must pass for `safe` to be `true`. Applications that merely happen to be deployed
to the same environment, with no relationship to A in either direction, are left out of
`consumerResults` and `providerResults` entirely and never make a check unsafe.

```mermaid
flowchart TD
    A["Can I Deploy?\napp=X, version=Y, env=E"] --> B{Any known consumers or\nproviders of X in env E?}
    B -->|Neither| C[✅ Safe — nothing\nto verify against]
    B -->|Some exist| D{Consumers in E verified\nagainst X@Y?}
    D -->|Missing verifications| F[❌ Not safe\n— list of missing verifications]
    D -->|All verified| G{X@Y verified against\nthe providers in E?}
    G -->|Missing verifications| F
    G -->|All verified| E[✅ Safe to deploy]

    style C fill:#2d5a27,color:#fff
    style E fill:#2d5a27,color:#fff
    style F fill:#5a2727,color:#fff
```

## API

### Request

```bash
curl -s \
  "https://stubborn.example.com/api/v1/can-i-deploy?application=my-service&version=1.2.3&environment=production" \
  -H "Authorization: Basic <base64-encoded-credentials>"
```

The optional `branch` query parameter scopes the check to a specific branch of the provider.
It is accepted but ignored by the OSS broker.

### Success response (safe to deploy)

```
HTTP/1.1 200 OK
Content-Type: application/json
```

```json
{
  "application": "my-service",
  "version": "1.2.3",
  "environment": "production",
  "safe": true,
  "summary": "All 2 consumer(s) and 1 provider(s) verified successfully",
  "consumerResults": [
    { "consumer": "payment-service", "consumerVersion": "4.1.0", "verified": true },
    { "consumer": "shipping-service", "consumerVersion": "2.0.0", "verified": true }
  ],
  "providerResults": [
    { "provider": "stock-service", "providerVersion": "5.0.0", "verified": true }
  ]
}
```

### Failure response (not safe to deploy)

```
HTTP/1.1 200 OK
Content-Type: application/json
```

```json
{
  "application": "my-service",
  "version": "1.2.3",
  "environment": "production",
  "safe": false,
  "summary": "1 of 2 consumer(s) and 1 of 1 provider(s) missing successful verification",
  "consumerResults": [
    { "consumer": "payment-service", "consumerVersion": "4.1.0", "verified": true },
    { "consumer": "shipping-service", "consumerVersion": "2.0.0", "verified": false }
  ],
  "providerResults": [
    { "provider": "stock-service", "providerVersion": "5.0.0", "verified": false }
  ]
}
```

### HTTP status codes

| Status | Meaning |
|--------|---------|
| `200` | Check completed — inspect `safe` in the response body |
| `400` | Missing required query parameters (`application`, `version`, or `environment`) |
| `401` | Unauthorized — credentials missing or invalid |
| `404` | Unknown application — the named application has never been registered |

## What does safe=false mean?

`safe=false` means at least one relationship in the target environment is unverified: either a
consumer deployed there has no passing verification against the version being checked, or the
version being checked has no passing verification against a provider deployed there.

**Rules that govern the result:**

- Every **known consumer** deployed to the target environment must have a `SUCCESS` verification
  against the exact provider version being deployed. One failing or missing verification makes
  the whole check unsafe.
- Every **known provider** deployed to the target environment must have a `SUCCESS` verification
  recorded for the exact pair (that provider's deployed version, the version being deployed).
  Deploying a consumer against a provider version it has never verified against is unsafe even
  when every consumer of the deployed application is happy.
- Only applications related to the one being checked are evaluated, in either direction. An
  application with no recorded relationship is ignored, however it is deployed. A relationship
  exists if a **dependency was declared** (see [Dependencies](./dependencies.md)) **or** the two
  have verified against each other at least once. A declaration is enough on its own, so a
  relationship that has not been verified yet is still evaluated rather than overlooked.
  Equally, once a pair has verified even once it is evaluated on every subsequent check, so a
  consumer that stops verifying still makes the check unsafe.
- An application is never its own consumer or provider, so its own deployment in the target
  environment is skipped in both directions.
- A missing verification counts as a failure. There is no "unknown" or "skipped" state —
  absence of a verification record is treated the same as a failed one.
- **Vacuous-truth case:** if neither known consumers nor known providers are currently deployed
  to the target environment, the result is `safe=true`. There is nothing that could be broken,
  so the deployment is unconditionally safe.
- **Pending contracts (first-time publishers):** when a provider publishes contracts for the
  very first time and no consumer has yet verified against them, those contracts are treated as
  safe to allow the initial deployment to proceed. Once consumers begin verifying, the normal
  rules apply.

## CI/CD integration

Run the check as a deployment gate in your pipeline. A non-zero exit code means deployment
should be blocked.

**Maven plugin**

```bash
./mvnw stubborn-contract:can-i-deploy \
  -Dstubborn.application=my-service \
  -Dstubborn.version=1.2.3 \
  -Dstubborn.environment=production
```

**Gradle plugin**

```bash
./gradlew canIDeploy \
  --application=my-service \
  --version=1.2.3 \
  --environment=production
```

**npm CLI (`@stubborn-sh/cli`)**

```bash
npx @stubborn-sh/cli can-i-deploy \
  --application my-service \
  --version 1.2.3 \
  --environment production
# Exit code 0 = safe, exit code 1 = unsafe
```

See specification: [docs/specs/005-can-i-deploy.md](https://github.com/stubborn-sh/stubborn/blob/main/docs/specs/005-can-i-deploy.md)

![Can I Deploy](/images/demo-can-i-deploy.png)
