import { Command } from "commander";
import type { BrokerClient } from "@stubborn-sh/broker-client";
import { formatOutput, formatSingle, formatSuccess } from "../formatter.js";

export function createAppCommand(
  getClient: () => BrokerClient,
  getFormat: () => "json" | "table",
): Command {
  const cmd = new Command("app").description("Manage applications");

  cmd
    .command("list")
    .description("List all applications")
    .option("-s, --search <query>", "Search filter")
    .option("-p, --page <number>", "Page number", "0")
    .option("--size <number>", "Page size", "20")
    .action(async (opts: { search?: string; page: string; size: string }) => {
      const result = await getClient().listApplications({
        search: opts.search,
        page: parseInt(opts.page, 10),
        size: parseInt(opts.size, 10),
      });
      console.log(
        formatOutput(
          result.content.map((a) => ({
            name: a.name,
            owner: a.owner,
            description: a.description,
            mainBranch: a.mainBranch,
            createdAt: a.createdAt,
          })),
          getFormat(),
        ),
      );
    });

  cmd
    .command("get <name>")
    .description("Get application details")
    .action(async (name: string) => {
      const app = await getClient().getApplication(name);
      console.log(formatSingle(app as unknown as Record<string, unknown>, getFormat()));
    });

  cmd
    .command("register")
    .description("Register a new application")
    .requiredOption("-n, --name <name>", "Application name")
    .requiredOption("-o, --owner <owner>", "Application owner")
    .option("-d, --description <desc>", "Description")
    .option("-b, --main-branch <branch>", "Main branch name")
    .action(
      async (opts: { name: string; owner: string; description?: string; mainBranch?: string }) => {
        const app = await getClient().registerApplication({
          name: opts.name,
          owner: opts.owner,
          description: opts.description,
          mainBranch: opts.mainBranch,
        });
        console.log(formatSuccess(`Application "${app.name}" registered.`));
        console.log(formatSingle(app as unknown as Record<string, unknown>, getFormat()));
      },
    );

  cmd
    .command("delete <name>")
    .description("Delete an application")
    .action(async (name: string) => {
      await getClient().deleteApplication(name);
      console.log(formatSuccess(`Application "${name}" deleted.`));
    });

  return cmd;
}
