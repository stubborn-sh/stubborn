import { Command } from "commander";
import type { BrokerClient } from "@stubborn-sh/broker-client";
import { formatOutput, formatSingle, formatSuccess } from "../formatter.js";

export function createEnvCommand(
  getClient: () => BrokerClient,
  getFormat: () => "json" | "table",
): Command {
  const cmd = new Command("env").description("Manage environments");

  cmd
    .command("list")
    .description("List all environments")
    .action(async () => {
      const envs = await getClient().listEnvironments();
      console.log(
        formatOutput(
          envs.map((e) => ({
            name: e.name,
            production: e.production,
            displayOrder: e.displayOrder,
            description: e.description,
          })),
          getFormat(),
        ),
      );
    });

  cmd
    .command("get <name>")
    .description("Get environment details")
    .action(async (name: string) => {
      const env = await getClient().getEnvironment(name);
      console.log(formatSingle(env as unknown as Record<string, unknown>, getFormat()));
    });

  cmd
    .command("create")
    .description("Create a new environment")
    .requiredOption("-n, --name <name>", "Environment name")
    .option("-d, --description <desc>", "Description")
    .option("--order <number>", "Display order", "0")
    .option("--production", "Mark as production", false)
    .action(
      async (opts: { name: string; description?: string; order: string; production: boolean }) => {
        const env = await getClient().createEnvironment({
          name: opts.name,
          description: opts.description,
          displayOrder: parseInt(opts.order, 10),
          production: opts.production,
        });
        console.log(formatSuccess(`Environment "${env.name}" created.`));
      },
    );

  cmd
    .command("update <name>")
    .description("Update an environment")
    .option("-d, --description <desc>", "Description")
    .option("--order <number>", "Display order", "0")
    .option("--production", "Mark as production", false)
    .action(
      async (name: string, opts: { description?: string; order: string; production: boolean }) => {
        await getClient().updateEnvironment(name, {
          description: opts.description,
          displayOrder: parseInt(opts.order, 10),
          production: opts.production,
        });
        console.log(formatSuccess(`Environment "${name}" updated.`));
      },
    );

  cmd
    .command("delete <name>")
    .description("Delete an environment")
    .action(async (name: string) => {
      await getClient().deleteEnvironment(name);
      console.log(formatSuccess(`Environment "${name}" deleted.`));
    });

  return cmd;
}
