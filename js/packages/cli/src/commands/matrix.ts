import { Command } from "commander";
import type { BrokerClient } from "@stubborn-sh/broker-client";
import { formatOutput } from "../formatter.js";

export function createMatrixCommand(
  getClient: () => BrokerClient,
  getFormat: () => "json" | "table",
): Command {
  return new Command("matrix")
    .description("Query compatibility matrix")
    .option("--provider <name>", "Filter by provider")
    .option("--consumer <name>", "Filter by consumer")
    .action(async (opts: { provider?: string; consumer?: string }) => {
      const entries = await getClient().queryMatrix(opts.provider, opts.consumer);
      console.log(
        formatOutput(
          entries.map((e) => ({
            provider: e.providerName,
            providerVersion: e.providerVersion,
            consumer: e.consumerName,
            consumerVersion: e.consumerVersion,
            status: e.status,
            verifiedAt: e.verifiedAt,
          })),
          getFormat(),
        ),
      );
    });
}
