import type { BrokerClient } from "@stubborn-sh/broker-client";
import type { ParsedContract } from "@stubborn-sh/stub-server";
import { loadFromDirectory, loadFromBroker } from "./contract-loader.js";
import { executeRequest } from "./request-executor.js";
import { validateResponse, type ValidationResult } from "./response-validator.js";
import type { Commands } from "./body-matchers.js";
import { reportResults } from "./reporter.js";

/** Configuration for contract verification. */
export interface VerifierConfig {
  /** Base URL of the provider to verify against. */
  readonly providerBaseUrl: string;
  /** Provider application name. */
  readonly providerName: string;
  /** Provider application version. */
  readonly providerVersion: string;
  /** Consumer application name (used for reporting). */
  readonly consumerName: string;
  /** Consumer application version (used for reporting). */
  readonly consumerVersion: string;
  /** Load contracts from this directory (mutually exclusive with broker). */
  readonly contractsDir?: string;
  /** Load contracts from the broker (mutually exclusive with contractsDir). */
  readonly broker?: {
    readonly client: BrokerClient;
    readonly applicationName: string;
    readonly version: string;
  };
  /** Report results to the broker. */
  readonly reportToBroker?: BrokerClient;
  /** Custom fetch implementation. */
  readonly fetch?: typeof globalThis.fetch;
  /**
   * JS stand-ins for the test base-class methods that `by_command` matchers (and header/cookie
   * `command`s) call on the JVM, by method name or full command text. For
   * `value: assertThatIdIsPositive($it)`, register `{ assertThatIdIsPositive: (id) => … }`;
   * throw or return false to fail. A command without a handler fails the contract.
   */
  readonly commands?: Commands;
}

/** Full verification result. */
export interface VerificationResult {
  readonly passed: boolean;
  readonly results: readonly ValidationResult[];
  readonly totalContracts: number;
  readonly passedContracts: number;
  readonly failedContracts: number;
}

/** Verify contracts against a provider. */
export class ContractVerifier {
  private readonly config: VerifierConfig;

  constructor(config: VerifierConfig) {
    this.config = config;
  }

  /** Run contract verification. */
  async verify(): Promise<VerificationResult> {
    const contracts = await this.loadContracts();
    const results: ValidationResult[] = [];

    for (const contract of contracts) {
      const actual = await executeRequest(this.config.providerBaseUrl, contract, this.config.fetch);
      const result = validateResponse(
        contract,
        actual,
        this.config.commands !== undefined ? { commands: this.config.commands } : undefined,
      );
      results.push(result);
    }

    if (this.config.reportToBroker !== undefined) {
      await reportResults(
        this.config.reportToBroker,
        this.config.providerName,
        this.config.providerVersion,
        this.config.consumerName,
        this.config.consumerVersion,
        results,
      );
    }

    const passedCount = results.filter((r) => r.valid).length;

    return {
      passed: results.every((r) => r.valid),
      results,
      totalContracts: results.length,
      passedContracts: passedCount,
      failedContracts: results.length - passedCount,
    };
  }

  private async loadContracts(): Promise<readonly ParsedContract[]> {
    if (this.config.contractsDir !== undefined) {
      return loadFromDirectory(this.config.contractsDir);
    }
    if (this.config.broker !== undefined) {
      return loadFromBroker(
        this.config.broker.client,
        this.config.broker.applicationName,
        this.config.broker.version,
      );
    }
    throw new Error("Either contractsDir or broker must be specified");
  }
}
