# Can I Deploy

Safety gate: determine if it is safe to deploy a specific version to an environment.

## Overview

The Can I Deploy check answers: "If I deploy version X of application A to environment E,
will all consumers in that environment have verified compatibility with version X?"

It examines:

1. All applications deployed in the target environment
2. For each consumer deployed there, whether a successful verification exists against the
   provider version being deployed

```mermaid
flowchart TD
    A["Can I Deploy?\napp=X, version=Y, env=E"] --> B{Any consumers\ndeployed in env E?}
    B -->|No consumers| C[✅ Safe — no consumers\nto verify against]
    B -->|Consumers exist| D{All consumers verified\nagainst version Y?}
    D -->|All verified| E[✅ Safe to deploy]
    D -->|Missing verifications| F[❌ Not safe\n— list of missing verifications]

    style C fill:#2d5a27,color:#fff
    style E fill:#2d5a27,color:#fff
    style F fill:#5a2727,color:#fff
```

## API

* `GET /api/v1/can-i-deploy?application=X&version=Y&environment=Z&branch=B` — Safety check
  (`branch` is optional)

Returns `{"application": "...", "version": "...", "environment": "...", "branch": "...", "safe": true/false, "summary": "...", "consumerResults": [...]}`.

See specification: [docs/specs/005-can-i-deploy.md](https://github.com/stubborn-sh/stubborn/blob/main/docs/specs/005-can-i-deploy.md)

![Can I Deploy](/images/demo-can-i-deploy.png)
