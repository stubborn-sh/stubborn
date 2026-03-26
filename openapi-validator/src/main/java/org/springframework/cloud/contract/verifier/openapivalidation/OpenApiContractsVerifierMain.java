/*
 * Copyright 2026-present the original author or authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package org.springframework.cloud.contract.verifier.openapivalidation;

import java.nio.file.Path;

/**
 * CLI entry point for validating contracts against OpenAPI specs.
 *
 * @since 5.0.2
 */
public final class OpenApiContractsVerifierMain {

	private OpenApiContractsVerifierMain() {
		throw new AssertionError("Utility class");
	}

	/**
	 * Runs validation from the command line.
	 *
	 * @since 5.0.2
	 */
	public static void main(String[] args) {
		if (args.length != 2) {
			System.err.println("Usage: <openapi-spec-path> <contracts-directory>");
			System.exit(2);
		}

		Path specPath = Path.of(args[0]);
		Path contractsDir = Path.of(args[1]);

		OpenApiVerificationReport report = new OpenApiContractsVerifier().verify(specPath, contractsDir);
		if (report.hasViolations()) {
			System.err.println(report.render());
			System.exit(1);
		}
		System.out.println(report.render());
	}

}
