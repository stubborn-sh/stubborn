# Stubborn Maven Plugin

Maven plugin for publishing contracts to and downloading stubs from the [Stubborn Broker](https://stubborn.sh) during Maven builds.

## Maven Coordinates

```xml
<plugin>
    <groupId>sh.stubborn</groupId>
    <artifactId>stubborn-maven-plugin</artifactId>
    <version>0.0.1</version>
</plugin>
```

## Configuration

```xml
<plugin>
    <groupId>sh.stubborn</groupId>
    <artifactId>stubborn-maven-plugin</artifactId>
    <version>0.0.1</version>
    <configuration>
        <brokerUrl>http://localhost:8080</brokerUrl>
        <applicationName>my-service</applicationName>
        <applicationVersion>${project.version}</applicationVersion>
        <!-- optional: path to contracts directory -->
        <contractsDirectory>${project.basedir}/src/test/resources/contracts</contractsDirectory>
    </configuration>
    <executions>
        <execution>
            <id>publish-contracts</id>
            <phase>verify</phase>
            <goals>
                <goal>publish</goal>
            </goals>
        </execution>
    </executions>
</plugin>
```

## Goals

| Goal | Phase | Description |
|------|-------|-------------|
| `publish` | `verify` | Scans for contracts and publishes them to the broker |
| `download-stubs` | `generate-test-sources` | Downloads consumer stubs from the broker |

## Related

- [Main project README](../README.md)
- [Stubborn Broker](https://stubborn.sh)
- [Live demo](https://demo.stubborn.sh)
