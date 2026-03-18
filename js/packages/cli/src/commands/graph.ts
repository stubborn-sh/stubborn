import { Command } from "commander";
import type { BrokerClient } from "@spring-cloud-contract/broker-client";
import { formatOutput, formatSingle } from "../formatter.js";

export function createGraphCommand(
  getClient: () => BrokerClient,
  getFormat: () => "json" | "table",
): Command {
  const cmd = new Command("graph").description("Dependency graph");

  cmd
    .command("show")
    .description("Show full dependency graph")
    .option("-e, --env <env>", "Filter by environment")
    .action(async (opts: { env?: string }) => {
      const graph = await getClient().getDependencyGraph(opts.env);
      if (getFormat() === "json") {
        console.log(JSON.stringify(graph, null, 2));
      } else {
        console.log("Nodes:");
        console.log(
          formatOutput(
            graph.nodes.map((n) => ({ name: n.applicationName, owner: n.owner })),
            "table",
          ),
        );
        console.log("\nEdges:");
        console.log(
          formatOutput(
            graph.edges.map((e) => ({
              provider: e.providerName,
              consumer: e.consumerName,
              status: e.status,
            })),
            "table",
          ),
        );
      }
    });

  cmd
    .command("app <name>")
    .description("Show dependencies for a specific application")
    .action(async (name: string) => {
      const deps = await getClient().getApplicationDependencies(name);
      console.log(formatSingle(deps as unknown as Record<string, unknown>, getFormat()));
    });

  return cmd;
}
