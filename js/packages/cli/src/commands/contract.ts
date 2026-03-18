import { Command } from "commander";
import type { BrokerClient } from "@spring-cloud-contract/broker-client";
import { ContractPublisher } from "@spring-cloud-contract/publisher";
import { formatOutput, formatSingle, formatSuccess, formatError } from "../formatter.js";

export function createContractCommand(
  getClient: () => BrokerClient,
  getFormat: () => "json" | "table",
): Command {
  const cmd = new Command("contract").description("Manage contracts");

  cmd
    .command("list")
    .description("List contracts for an application version")
    .requiredOption("-a, --app <name>", "Application name")
    .requiredOption("-v, --version <version>", "Application version")
    .option("-p, --page <number>", "Page number", "0")
    .option("--size <number>", "Page size", "20")
    .action(async (opts: { app: string; version: string; page: string; size: string }) => {
      const result = await getClient().listContracts(opts.app, opts.version, {
        page: parseInt(opts.page, 10),
        size: parseInt(opts.size, 10),
      });
      console.log(
        formatOutput(
          result.content.map((c) => ({
            contractName: c.contractName,
            contentType: c.contentType,
            createdAt: c.createdAt,
          })),
          getFormat(),
        ),
      );
    });

  cmd
    .command("get")
    .description("Get a specific contract")
    .requiredOption("-a, --app <name>", "Application name")
    .requiredOption("-v, --version <version>", "Application version")
    .requiredOption("-c, --contract <name>", "Contract name")
    .action(async (opts: { app: string; version: string; contract: string }) => {
      const contract = await getClient().getContract(opts.app, opts.version, opts.contract);
      console.log(formatSingle(contract as unknown as Record<string, unknown>, getFormat()));
    });

  cmd
    .command("publish")
    .description("Publish contracts from a directory")
    .requiredOption("-a, --app <name>", "Application name")
    .requiredOption("-v, --version <version>", "Application version")
    .requiredOption("-d, --dir <path>", "Contracts directory")
    .action(async (opts: { app: string; version: string; dir: string }) => {
      const publisher = new ContractPublisher(getClient());
      const result = await publisher.publish({
        applicationName: opts.app,
        version: opts.version,
        contractsDir: opts.dir,
      });

      if (result.published.length > 0) {
        console.log(formatSuccess(`Published ${String(result.published.length)} contract(s).`));
      }
      if (result.errors.length > 0) {
        for (const err of result.errors) {
          console.error(formatError(`Failed to publish ${err.contractName}: ${err.error.message}`));
        }
      }
    });

  cmd
    .command("delete")
    .description("Delete a contract")
    .requiredOption("-a, --app <name>", "Application name")
    .requiredOption("-v, --version <version>", "Application version")
    .requiredOption("-c, --contract <name>", "Contract name")
    .action(async (opts: { app: string; version: string; contract: string }) => {
      await getClient().deleteContract(opts.app, opts.version, opts.contract);
      console.log(formatSuccess(`Contract "${opts.contract}" deleted.`));
    });

  return cmd;
}
