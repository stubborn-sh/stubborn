import { Command } from "commander";
import type { BrokerClient } from "@spring-cloud-contract/broker-client";
import { formatOutput, formatSuccess } from "../formatter.js";

export function createVerifyCommand(
  getClient: () => BrokerClient,
  getFormat: () => "json" | "table",
): Command {
  const cmd = new Command("verify").description("Manage verification results");

  cmd
    .command("record")
    .description("Record a verification result")
    .requiredOption("--provider <name>", "Provider application name")
    .requiredOption("--provider-version <version>", "Provider version")
    .requiredOption("--consumer <name>", "Consumer application name")
    .requiredOption("--consumer-version <version>", "Consumer version")
    .requiredOption("--status <status>", "Verification status (SUCCESS|FAILED)")
    .option("--details <details>", "Verification details")
    .action(
      async (opts: {
        provider: string;
        providerVersion: string;
        consumer: string;
        consumerVersion: string;
        status: string;
        details?: string;
      }) => {
        const result = await getClient().recordVerification({
          providerName: opts.provider,
          providerVersion: opts.providerVersion,
          consumerName: opts.consumer,
          consumerVersion: opts.consumerVersion,
          status: opts.status as "SUCCESS" | "FAILED",
          details: opts.details,
        });
        console.log(formatSuccess(`Verification recorded: ${result.status}`));
      },
    );

  cmd
    .command("list")
    .description("List verifications")
    .option("-s, --search <query>", "Search filter")
    .option("-p, --page <number>", "Page number", "0")
    .option("--size <number>", "Page size", "20")
    .action(async (opts: { search?: string; page: string; size: string }) => {
      const result = await getClient().listVerifications({
        search: opts.search,
        page: parseInt(opts.page, 10),
        size: parseInt(opts.size, 10),
      });
      console.log(
        formatOutput(
          result.content.map((v) => ({
            provider: v.providerName,
            providerVersion: v.providerVersion,
            consumer: v.consumerName,
            consumerVersion: v.consumerVersion,
            status: v.status,
            verifiedAt: v.verifiedAt,
          })),
          getFormat(),
        ),
      );
    });

  return cmd;
}
