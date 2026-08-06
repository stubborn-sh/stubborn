# UI Tour

Stubborn ships with a built-in web dashboard. All features are also available via the REST API and CLI.

::: tip
Try the live demo at https://demo.stubborn.sh (credentials: `reader` / `reader`).
:::

## Dashboard

The dashboard shows application counts, verification trends over the last 7 days, recent verifications, and a dependency graph overview.

![Dashboard](/images/demo-dashboard.png)

## Applications

Register and manage your services. Each application shows its published versions, owner, main branch, and repository link.

![Applications](/images/demo-applications.png)

## Contracts

Browse published contracts per application and version. View contract content inline.

![Contracts](/images/demo-contracts.png)

## Verifications

Track all verification results — which consumer verified against which provider, with status and timestamps.

![Verifications](/images/demo-verifications.png)

## Environments

The deployment overview matrix shows at a glance which version of each service is deployed to which environment.

![Environments](/images/demo-environments.png)

## Can I Deploy?

The safety check tells you whether it's safe to deploy a specific version to a specific environment. It checks all consumer contracts.

![Can I Deploy](/images/demo-can-i-deploy.png)

## Dependency Graph

Visualize service dependencies and their verification status. Click any node to see its providers and consumers.

![Dependency Graph with HTTP and Messaging edges](/images/demo-graph-messaging.png)

## Webhooks

Configure webhook subscriptions to get notified when contracts are published, verifications succeed or fail, or deployments are recorded.

![Webhooks](/images/demo-webhooks.png)

## Tags

Tag specific application versions (e.g. `latest`, `stable`) and filter by tag.

![Tags](/images/demo-tags.png)
