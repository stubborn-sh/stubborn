# Feature 5: Can I Deploy

## What
A safety check endpoint that determines whether an application version can be safely deployed
to a given environment. It verifies both directions: that the consumers of the application
deployed in that environment have successfully verified against the version being deployed,
and that the version being deployed has successfully verified against the providers deployed
there.

## Why
Deploying a provider that breaks its consumers causes production incidents. So does deploying
a consumer against a provider version it has never verified against. This check prevents both
by ensuring all contract verifications pass before allowing deployment.

## How (High Level)
1. Find the applications currently deployed to the target environment
2. Keep the known consumers of the application — applications that declared a dependency on it
   or were recorded as the consumer side of a verification against it, at any version and with
   any status — and for each check that a successful verification exists between the version
   being deployed and the consumer's deployed version
3. Keep the known providers of the application — applications it declared a dependency on or
   verified against, under the same rule — and for each check that a successful verification
   exists between that provider's deployed version and the version being deployed
4. Return safe=true only if ALL of them, in both directions, have successful verifications

## Business Rules
- Only known consumers and known providers of the application are evaluated. An application
  deployed to the same environment with no recorded relationship in either direction is not
  part of the check and never appears in `consumerResults` or `providerResults`
- The application is never its own consumer or provider, so its own deployment to the target
  environment is skipped in both directions
- If neither known consumers nor known providers are deployed to the environment, deployment is
  safe (vacuously true)
- If a consumer is deployed but no verification exists for the provider version + consumer version, it is NOT safe
- If a provider is deployed but no verification exists for that provider's deployed version +
  the version being deployed, it is NOT safe
- If a verification exists but its status is FAILED, it is NOT safe
- Only SUCCESS verifications count
- The application must exist (404 if not found)
- The environment name must be valid

## API
```
GET /api/v1/can-i-deploy?application={name}&version={version}&environment={env}
```

### Response (200)
```json
{
  "application": "order-service",
  "version": "2.0.0",
  "environment": "production",
  "safe": true,
  "summary": "All 2 consumer(s) and 1 provider(s) verified successfully",
  "consumerResults": [
    {
      "consumer": "payment-service",
      "consumerVersion": "1.5.0",
      "verified": true
    },
    {
      "consumer": "shipping-service",
      "consumerVersion": "3.0.0",
      "verified": true
    }
  ],
  "providerResults": [
    {
      "provider": "stock-service",
      "providerVersion": "5.0.0",
      "verified": true
    }
  ]
}
```

### Error Cases
- 404: Application not found
- 400: Missing required query parameters, invalid version format
