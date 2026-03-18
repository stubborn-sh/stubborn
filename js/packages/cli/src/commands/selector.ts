import { Command } from "commander";
import type { BrokerClient } from "@spring-cloud-contract/broker-client";
import { formatOutput } from "../formatter.js";

export function createSelectorCommand(
  getClient: () => BrokerClient,
  getFormat: () => "json" | "table",
): Command {
  const cmd = new Command("selector").description("Resolve consumer version selectors");

  cmd
    .command("resolve")
    .description("Resolve selectors to find contract versions")
    .requiredOption("--selectors <json>", "Selectors as JSON array")
    .action(async (opts: { selectors: string }) => {
      let selectors: Record<string, unknown>[];
      try {
        selectors = JSON.parse(opts.selectors) as Record<string, unknown>[];
      } catch {
        throw new Error("Invalid JSON for --selectors. Expected a JSON array of selector objects.");
      }
      const resolved = await getClient().resolveSelectors(selectors);
      console.log(
        formatOutput(
          resolved.map((r) => ({
            consumer: r.consumerName,
            version: r.version,
            branch: r.branch,
            contractName: r.contractName,
          })),
          getFormat(),
        ),
      );
    });

  return cmd;
}
