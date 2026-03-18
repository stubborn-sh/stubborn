# Feature 5: Can I Deploy

## What
A safety check endpoint that determines whether an application version can be safely deployed
to a given environment. It verifies that all consumers of the application in that environment
have successfully verified their contracts against the version being deployed.

## Why
Deploying a provider that breaks its consumers causes production incidents. This check prevents
unsafe deployments by ensuring all contract verifications pass before allowing deployment.

## How (High Level)
1. Find all verifications where the application is the provider with the given version
2. Find all consumers currently deployed to the target environment
3. For each deployed consumer, check if a successful verification exists between the
   provider version and the consumer's deployed version
4. Return safe=true only if ALL deployed consumers have successful verifications

## Business Rules
- If no consumers are deployed to the environment, deployment is safe (vacuously true)
- If a consumer is deployed but no verification exists for the provider version + consumer version, it is NOT safe
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
  "summary": "All 2 consumer(s) verified successfully",
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
  ]
}
```

### Error Cases
- 404: Application not found
- 400: Missing required query parameters, invalid version format
