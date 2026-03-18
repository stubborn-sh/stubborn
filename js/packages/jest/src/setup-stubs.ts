import {
  StubServer,
  parseContract,
  loadFromDirectory,
  type ParsedContract,
} from "@spring-cloud-contract/stub-server";
import { BrokerClient, fetchAllPages } from "@spring-cloud-contract/broker-client";
import { fetchStubsJar, loadLocalJar, type MavenStubsJar } from "./jar-fetcher.js";

/** Configuration for setting up stubs from the broker. */
export interface BrokerStubsConfig {
  /** Broker URL to fetch contracts from. */
  readonly brokerUrl: string;
  /** Application name whose contracts to load. */
  readonly applicationName: string;
  /** Version of the application. */
  readonly version: string;
  /** Port for the stub server (0 for random). */
  readonly port?: number;
  /** Broker authentication. */
  readonly username?: string;
  readonly password?: string;
  readonly token?: string;
}

/** Configuration for setting up stubs from a local contracts directory. */
export interface LocalContractsConfig {
  /** Local directory containing YAML contract files. */
  readonly contractsDir: string;
  /** Port for the stub server (0 for random). */
  readonly port?: number;
}

/** Configuration for setting up stubs from a local WireMock mappings directory. */
export interface LocalMappingsConfig {
  /** Local directory containing WireMock JSON mapping files. */
  readonly mappingsDir: string;
  /** Port for the stub server (0 for random). */
  readonly port?: number;
}

/** Configuration for setting up stubs from a Maven stubs JAR. */
export interface JarStubsConfig {
  /** Maven coordinates for the stubs JAR. */
  readonly stubsJar: MavenStubsJar;
  /** Port for the stub server (0 for random). */
  readonly port?: number;
}

/** Configuration for setting up stubs from a local stubs JAR file. */
export interface LocalJarConfig {
  /** Path to a local stubs JAR file. */
  readonly jarPath: string;
  /** Port for the stub server (0 for random). */
  readonly port?: number;
}

/**
 * Stubs configuration — supports multiple sources:
 * - Broker: fetch contracts from broker API (`brokerUrl` + `applicationName` + `version`)
 * - Local contracts: YAML files on disk (`contractsDir`)
 * - Local mappings: WireMock JSON files on disk (`mappingsDir`)
 * - Maven JAR: download and extract a stubs JAR (`stubsJar`)
 * - Local JAR: extract a local stubs JAR file (`jarPath`)
 */
export type SetupStubsConfig =
  | BrokerStubsConfig
  | LocalContractsConfig
  | LocalMappingsConfig
  | JarStubsConfig
  | LocalJarConfig;

let stubServer: StubServer | null = null;
let assignedPort = 0;

/**
 * Set up a stub server with contracts from a configured source.
 * Call this in beforeAll/beforeEach.
 * Returns the port the server is listening on.
 */
export async function setupStubs(config: SetupStubsConfig): Promise<number> {
  const contracts = await loadContracts(config);

  stubServer = new StubServer({ port: config.port ?? 0 });
  stubServer.setContracts(contracts);
  assignedPort = await stubServer.start();
  return assignedPort;
}

/** Tear down the stub server. Call this in afterAll/afterEach. */
export async function teardownStubs(): Promise<void> {
  if (stubServer !== null) {
    await stubServer.stop();
    stubServer = null;
    assignedPort = 0;
  }
}

/** Get the port the stub server is listening on. */
export function getStubPort(): number {
  return assignedPort;
}

async function loadContracts(config: SetupStubsConfig): Promise<readonly ParsedContract[]> {
  if (isBrokerConfig(config)) {
    return loadFromBroker(config);
  }

  if (isLocalContractsConfig(config)) {
    return loadFromDirectory(config.contractsDir, "contracts");
  }

  if (isLocalMappingsConfig(config)) {
    return loadFromDirectory(config.mappingsDir, "wiremock");
  }

  if (isJarConfig(config)) {
    return fetchStubsJar(config.stubsJar);
  }

  if (isLocalJarConfig(config)) {
    return loadLocalJar(config.jarPath);
  }

  throw new Error(
    "Invalid stubs config: provide one of brokerUrl, contractsDir, mappingsDir, stubsJar, or jarPath",
  );
}

async function loadFromBroker(config: BrokerStubsConfig): Promise<readonly ParsedContract[]> {
  const client = new BrokerClient({
    baseUrl: config.brokerUrl,
    username: config.username,
    password: config.password,
    token: config.token,
  });

  const contractResponses = await fetchAllPages((params) =>
    client.listContracts(config.applicationName, config.version, params),
  );

  return contractResponses
    .filter((c) => c.contentType === "application/x-yaml")
    .map((c) => parseContract(c.contractName, c.content));
}

function isBrokerConfig(config: SetupStubsConfig): config is BrokerStubsConfig {
  return "brokerUrl" in config;
}

function isLocalContractsConfig(config: SetupStubsConfig): config is LocalContractsConfig {
  return "contractsDir" in config;
}

function isLocalMappingsConfig(config: SetupStubsConfig): config is LocalMappingsConfig {
  return "mappingsDir" in config;
}

function isJarConfig(config: SetupStubsConfig): config is JarStubsConfig {
  return "stubsJar" in config;
}

function isLocalJarConfig(config: SetupStubsConfig): config is LocalJarConfig {
  return "jarPath" in config;
}
