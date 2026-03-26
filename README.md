# Stubborn OpenAPI Validator

Validates [Spring Cloud Contract](https://spring.io/projects/spring-cloud-contract) DSL files against OpenAPI specifications.

**No Stubborn dependency required** -- use this standalone with any Spring Cloud Contract project.

## Features

- Validate SCC contracts (YAML, Groovy, Java) against an OpenAPI spec
- Convert OpenAPI 3.x specs to SCC contract DSL
- JUnit 5 extension for automated validation in tests
- Detect missing endpoints, invalid status codes, schema mismatches

## Usage

Add the dependency:

```xml
<dependency>
    <groupId>sh.stubborn</groupId>
    <artifactId>spring-cloud-contract-openapi-validator</artifactId>
    <version>0.1.0-SNAPSHOT</version>
    <scope>test</scope>
</dependency>
```

Use the JUnit 5 extension:

```java
@ExtendWith(OpenApiContractsVerifierExtension.class)
@VerifyContractsAgainstOpenApi(openApiSpec = "openapi/my-service.yml")
class ContractValidationTest {
    // Contracts in src/test/resources/contracts/ are validated automatically
}
```

## Links

- [Stubborn](https://stubborn.sh) -- contract governance platform
- [Spring Cloud Contract](https://spring.io/projects/spring-cloud-contract)
