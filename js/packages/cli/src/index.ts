import { Command } from "commander";
import { BrokerClient } from "@stubborn-sh/broker-client";
import { resolveCliConfig, type CliConfig } from "./config.js";
import { formatError } from "./formatter.js";
import { createAppCommand } from "./commands/app.js";
import { createContractCommand } from "./commands/contract.js";
import { createVerifyCommand } from "./commands/verify.js";
import { createDeployCommand } from "./commands/deploy.js";
import { createCanIDeployCommand } from "./commands/can-i-deploy.js";
import { createEnvCommand } from "./commands/env.js";
import { createGraphCommand } from "./commands/graph.js";
import { createMatrixCommand } from "./commands/matrix.js";
import { createTagCommand } from "./commands/tag.js";
import { createWebhookCommand } from "./commands/webhook.js";
import { createSelectorCommand } from "./commands/selector.js";
import { createCleanupCommand } from "./commands/cleanup.js";
import { createTopicsCommand } from "./commands/topics.js";

const program = new Command()
  .name("stubborn")
  .description("Stubborn CLI")
  .version("0.1.0")
  .option("--broker-url <url>", "Broker URL")
  .option("--username <user>", "Username for basic auth")
  .option("--password <pass>", "Password for basic auth")
  .option("--token <token>", "Bearer token for auth")
  .option("--format <format>", "Output format (json|table)", "table");

let resolvedConfig: CliConfig | null = null;
let clientInstance: BrokerClient | null = null;

function getConfig(): CliConfig {
  if (resolvedConfig === null) {
    throw new Error("Config not resolved yet");
  }
  return resolvedConfig;
}

function getClient(): BrokerClient {
  if (clientInstance === null) {
    const config = getConfig();
    clientInstance = new BrokerClient(config);
  }
  return clientInstance;
}

function getFormat(): "json" | "table" {
  return getConfig().format;
}

// Resolve config AFTER parseAsync has populated opts, but BEFORE any command runs
program.hook("preAction", async () => {
  const opts = program.opts<{
    brokerUrl?: string;
    username?: string;
    password?: string;
    token?: string;
    format?: string;
  }>();

  resolvedConfig = await resolveCliConfig({
    baseUrl: opts.brokerUrl,
    username: opts.username,
    password: opts.password,
    token: opts.token,
    format: opts.format as "json" | "table" | undefined,
  });
});

program.addCommand(createAppCommand(getClient, getFormat));
program.addCommand(createContractCommand(getClient, getFormat));
program.addCommand(createVerifyCommand(getClient, getFormat));
program.addCommand(createDeployCommand(getClient, getFormat));
program.addCommand(createCanIDeployCommand(getClient, getFormat));
program.addCommand(createEnvCommand(getClient, getFormat));
program.addCommand(createGraphCommand(getClient, getFormat));
program.addCommand(createMatrixCommand(getClient, getFormat));
program.addCommand(createTagCommand(getClient, getFormat));
program.addCommand(createWebhookCommand(getClient, getFormat));
program.addCommand(createSelectorCommand(getClient, getFormat));
program.addCommand(createCleanupCommand(getClient, getFormat));
program.addCommand(createTopicsCommand(getClient, getFormat));

async function main(): Promise<void> {
  await program.parseAsync(process.argv);
}

main().catch((err: unknown) => {
  console.error(formatError(err instanceof Error ? err.message : String(err)));
  process.exitCode = 1;
});
