# Generated stubs fixtures

`mappings/` is the unmodified output of `stubborn-contract-maven-plugin:0.1.3:convert`
for the Groovy contracts in `contracts/`. Tests load these mappings as they are, so the
stub server is exercised against what the contract generator really writes.

Regenerate: put `contracts/*.groovy` under `src/test/resources/contracts/items/` of a
throwaway Maven project and run

    mvn sh.stubborn:stubborn-contract-maven-plugin:0.1.3:convert

then copy `target/stubs/META-INF/<group>/<artifact>/<version>/mappings/items/*.json` here.

Expected outcomes in the tests were recorded against WireMock 3.13.2 standalone serving
the same mappings.
