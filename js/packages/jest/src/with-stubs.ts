import { setupStubs, teardownStubs, type SetupStubsConfig } from "./setup-stubs.js";

/**
 * Wrapper that sets up stubs, runs the test function, then tears down.
 * Provides the stub server port to the test function.
 *
 * Supports all config modes: broker, local contracts, local mappings, and Maven JAR.
 */
export async function withStubs(
  config: SetupStubsConfig,
  testFn: (stubPort: number) => Promise<void>,
): Promise<void> {
  const port = await setupStubs(config);
  try {
    await testFn(port);
  } finally {
    await teardownStubs();
  }
}
