# Stubborn API Client

Generated REST client for the [Stubborn Broker](https://stubborn.sh) API.

Built with OpenAPI Generator on top of Spring's `RestClient`.

## Maven Coordinates

```xml
<dependency>
    <groupId>sh.stubborn</groupId>
    <artifactId>stubborn-api-client</artifactId>
    <version>0.0.1</version>
</dependency>
```

## Usage

```java
import sh.stubborn.client.ApplicationsApi;
import sh.stubborn.client.ContractsApi;
import sh.stubborn.client.invoker.ApiClient;

ApiClient apiClient = new ApiClient();
apiClient.setBasePath("http://localhost:8080");
// apiClient.setBearerToken("your-token");

ApplicationsApi applicationsApi = new ApplicationsApi(apiClient);
var applications = applicationsApi.getApplications();

ContractsApi contractsApi = new ContractsApi(apiClient);
var contracts = contractsApi.getContracts("my-service", "1.0.0");
```

For Spring Boot projects, configure the base URL via properties and inject the API beans directly.

## Related

- [Main project README](../README.md)
- [Stubborn Broker](https://stubborn.sh)
- [Live demo](https://demo.stubborn.sh)
