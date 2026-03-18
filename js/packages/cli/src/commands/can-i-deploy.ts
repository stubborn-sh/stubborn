import { Command } from "commander";
import type { BrokerClient } from "@spring-cloud-contract/broker-client";
import { formatSingle, formatSuccess, formatError } from "../formatter.js";

export function createCanIDeployCommand(
  getClient: () => BrokerClient,
  getFormat: () => "json" | "table",
): Command {
  return new Command("can-i-deploy")
    .description("Check if an application version can be safely deployed")
    .requiredOption("-a, --app <name>", "Application name")
    .requiredOption("-v, --version <version>", "Application version")
    .requiredOption("-e, --env <env>", "Target environment")
    .action(async (opts: { app: string; version: string; env: string }) => {
      const result = await getClient().canIDeploy(opts.app, opts.version, opts.env);
      console.log(formatSingle(result as unknown as Record<string, unknown>, getFormat()));
      if (result.safe) {
        console.log(formatSuccess("\nSafe to deploy!"));
      } else {
        console.log(formatError("\nNot safe to deploy."));
        process.exitCode = 1;
      }
    });
}
