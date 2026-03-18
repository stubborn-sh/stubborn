import { Command } from "commander";
import type { BrokerClient } from "@spring-cloud-contract/broker-client";
import { formatSuccess } from "../formatter.js";

export function createCleanupCommand(
  getClient: () => BrokerClient,
  _getFormat: () => "json" | "table",
): Command {
  return new Command("cleanup")
    .description("Run data cleanup")
    .requiredOption("--keep <number>", "Number of latest versions to keep")
    .option("-a, --app <name>", "Application name (null for all)")
    .option("--protected-envs <envs>", "Comma-separated protected environments")
    .action(async (opts: { keep: string; app?: string; protectedEnvs?: string }) => {
      const result = await getClient().runCleanup({
        keepLatestVersions: parseInt(opts.keep, 10),
        applicationName: opts.app,
        protectedEnvironments: opts.protectedEnvs?.split(","),
      });
      console.log(
        formatSuccess(`Cleanup complete: deleted ${String(result.deletedCount)} version(s).`),
      );
      if (result.deletedContracts.length > 0) {
        console.log(`Deleted contracts: ${result.deletedContracts.join(", ")}`);
      }
    });
}
