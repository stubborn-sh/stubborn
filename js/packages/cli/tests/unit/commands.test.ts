import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BrokerClient } from "@spring-cloud-contract/broker-client";
import { createAppCommand } from "../../src/commands/app.js";
import { createContractCommand } from "../../src/commands/contract.js";
import { createCanIDeployCommand } from "../../src/commands/can-i-deploy.js";
import { createEnvCommand } from "../../src/commands/env.js";
import { createVerifyCommand } from "../../src/commands/verify.js";
import { createDeployCommand } from "../../src/commands/deploy.js";
import { Command } from "commander";

function mockClient(): BrokerClient {
  return {
    listApplications: vi.fn().mockResolvedValue({
      content: [
        {
          name: "app1",
          owner: "team1",
          description: "desc",
          mainBranch: "main",
          createdAt: "2026-01-01",
        },
      ],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    }),
    getApplication: vi.fn().mockResolvedValue({ name: "app1", owner: "team1" }),
    registerApplication: vi.fn().mockResolvedValue({ name: "new-app", owner: "team1" }),
    deleteApplication: vi.fn().mockResolvedValue(undefined),
    listContracts: vi.fn().mockResolvedValue({
      content: [{ contractName: "c.yaml", contentType: "application/x-yaml" }],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    }),
    getContract: vi.fn().mockResolvedValue({ contractName: "c.yaml", content: "..." }),
    canIDeploy: vi.fn().mockResolvedValue({ safe: true, reason: "All verified" }),
    listEnvironments: vi
      .fn()
      .mockResolvedValue([
        { name: "prod", production: true, displayOrder: 0, description: "Production" },
      ]),
    recordVerification: vi.fn().mockResolvedValue({ id: 1, status: "SUCCESS" }),
    listVerifications: vi.fn().mockResolvedValue({
      content: [{ id: 1, status: "SUCCESS" }],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    }),
    recordDeployment: vi.fn().mockResolvedValue({ id: 1 }),
    listDeployments: vi.fn().mockResolvedValue({
      content: [{ id: 1 }],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    }),
  } as unknown as BrokerClient;
}

describe("CLI commands", () => {
  let client: BrokerClient;
  let getClient: () => BrokerClient;
  let getFormat: () => "json" | "table";
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = mockClient();
    getClient = () => client;
    getFormat = () => "table";
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  describe("app command", () => {
    it("should_list_applications", async () => {
      const program = new Command().exitOverride();
      program.addCommand(createAppCommand(getClient, getFormat));
      await program.parseAsync(["node", "test", "app", "list"]);

      expect(client.listApplications).toHaveBeenCalledWith({
        search: undefined,
        page: 0,
        size: 20,
      });
      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should_get_application_by_name", async () => {
      const program = new Command().exitOverride();
      program.addCommand(createAppCommand(getClient, getFormat));
      await program.parseAsync(["node", "test", "app", "get", "my-app"]);

      expect(client.getApplication).toHaveBeenCalledWith("my-app");
    });

    it("should_register_application", async () => {
      const program = new Command().exitOverride();
      program.addCommand(createAppCommand(getClient, getFormat));
      await program.parseAsync(["node", "test", "app", "register", "-n", "my-app", "-o", "team1"]);

      expect(client.registerApplication).toHaveBeenCalledWith(
        expect.objectContaining({ name: "my-app", owner: "team1" }),
      );
    });

    it("should_delete_application_and_verify_method_and_name", async () => {
      const program = new Command().exitOverride();
      program.addCommand(createAppCommand(getClient, getFormat));
      await program.parseAsync(["node", "test", "app", "delete", "my-app"]);

      expect(client.deleteApplication).toHaveBeenCalledWith("my-app");
    });
  });

  describe("contract command", () => {
    it("should_list_contracts", async () => {
      const program = new Command().exitOverride();
      program.addCommand(createContractCommand(getClient, getFormat));
      await program.parseAsync(["node", "test", "contract", "list", "-a", "my-app", "-v", "1.0"]);

      expect(client.listContracts).toHaveBeenCalledWith(
        "my-app",
        "1.0",
        expect.objectContaining({ page: 0 }),
      );
    });
  });

  describe("can-i-deploy command", () => {
    it("should_check_deployment_safety", async () => {
      const program = new Command().exitOverride();
      program.addCommand(createCanIDeployCommand(getClient, getFormat));
      await program.parseAsync([
        "node",
        "test",
        "can-i-deploy",
        "-a",
        "app",
        "-v",
        "1.0",
        "-e",
        "prod",
      ]);

      expect(client.canIDeploy).toHaveBeenCalledWith("app", "1.0", "prod");
    });

    it("should_set_exit_code_when_not_safe", async () => {
      (client.canIDeploy as ReturnType<typeof vi.fn>).mockResolvedValue({
        safe: false,
        reason: "Unverified",
      });
      const prevExitCode = process.exitCode;

      const program = new Command().exitOverride();
      program.addCommand(createCanIDeployCommand(getClient, getFormat));
      await program.parseAsync([
        "node",
        "test",
        "can-i-deploy",
        "-a",
        "app",
        "-v",
        "1.0",
        "-e",
        "prod",
      ]);

      expect(process.exitCode).toBe(1);
      process.exitCode = prevExitCode;
    });
  });

  describe("env command", () => {
    it("should_list_environments", async () => {
      const program = new Command().exitOverride();
      program.addCommand(createEnvCommand(getClient, getFormat));
      await program.parseAsync(["node", "test", "env", "list"]);

      expect(client.listEnvironments).toHaveBeenCalled();
    });
  });

  describe("verify command", () => {
    it("should_record_verification", async () => {
      const program = new Command().exitOverride();
      program.addCommand(createVerifyCommand(getClient, getFormat));
      await program.parseAsync([
        "node",
        "test",
        "verify",
        "record",
        "--provider",
        "p",
        "--provider-version",
        "1.0",
        "--consumer",
        "c",
        "--consumer-version",
        "2.0",
        "--status",
        "SUCCESS",
      ]);

      expect(client.recordVerification).toHaveBeenCalledWith(
        expect.objectContaining({
          providerName: "p",
          providerVersion: "1.0",
          consumerName: "c",
          consumerVersion: "2.0",
          status: "SUCCESS",
        }),
      );
    });
  });

  describe("deploy command", () => {
    it("should_record_deployment", async () => {
      const program = new Command().exitOverride();
      program.addCommand(createDeployCommand(getClient, getFormat));
      await program.parseAsync([
        "node",
        "test",
        "deploy",
        "record",
        "-a",
        "app",
        "-v",
        "1.0",
        "-e",
        "prod",
      ]);

      expect(client.recordDeployment).toHaveBeenCalledWith(
        "prod",
        expect.objectContaining({
          applicationName: "app",
          version: "1.0",
        }),
      );
    });
  });
});
