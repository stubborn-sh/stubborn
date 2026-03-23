import { Command } from "commander";
import type { BrokerClient } from "@stubborn-sh/broker-client";
import { formatOutput, formatSuccess } from "../formatter.js";

export function createDeployCommand(
  getClient: () => BrokerClient,
  getFormat: () => "json" | "table",
): Command {
  const cmd = new Command("deploy").description("Manage deployments");

  cmd
    .command("record")
    .description("Record a deployment")
    .requiredOption("-e, --env <env>", "Environment name")
    .requiredOption("-a, --app <name>", "Application name")
    .requiredOption("-v, --version <version>", "Application version")
    .action(async (opts: { env: string; app: string; version: string }) => {
      const result = await getClient().recordDeployment(opts.env, {
        applicationName: opts.app,
        version: opts.version,
      });
      console.log(
        formatSuccess(
          `Deployment recorded: ${result.applicationName}@${result.version} → ${result.environment}`,
        ),
      );
    });

  cmd
    .command("list")
    .description("List deployments for an environment")
    .requiredOption("-e, --env <env>", "Environment name")
    .option("-p, --page <number>", "Page number", "0")
    .option("--size <number>", "Page size", "20")
    .action(async (opts: { env: string; page: string; size: string }) => {
      const result = await getClient().listDeployments(opts.env, {
        page: parseInt(opts.page, 10),
        size: parseInt(opts.size, 10),
      });
      console.log(
        formatOutput(
          result.content.map((d) => ({
            application: d.applicationName,
            version: d.version,
            environment: d.environment,
            deployedAt: d.deployedAt,
          })),
          getFormat(),
        ),
      );
    });

  return cmd;
}
