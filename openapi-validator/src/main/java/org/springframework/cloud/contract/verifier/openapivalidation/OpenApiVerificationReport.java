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

import java.util.List;

/**
 * Aggregated validation report for OpenAPI contract checks.
 *
 * @since 5.0.2
 */
public record OpenApiVerificationReport(
		/**
		 * Collected validation violations.
		 *
		 * @since 5.0.2
		 */
		List<OpenApiContractViolation> violations) {

	/**
	 * Returns whether any violations were recorded.
	 *
	 * @since 5.0.2
	 */
	public boolean hasViolations() {
		return !violations.isEmpty();
	}

	/**
	 * Renders the report as a human-readable string.
	 *
	 * @since 5.0.2
	 */
	public String render() {
		if (violations.isEmpty()) {
			return "✅ All contracts match the OpenAPI specification.";
		}
		StringBuilder builder = new StringBuilder();
		builder.append("❌ Found ")
			.append(violations.size())
			.append(" contract violations:")
			.append(System.lineSeparator());
		for (int i = 0; i < violations.size(); i++) {
			OpenApiContractViolation violation = violations.get(i);
			builder.append(i + 1).append(") ").append(renderViolation(violation)).append(System.lineSeparator());
		}
		return builder.toString().trim();
	}

	private String renderViolation(OpenApiContractViolation violation) {
		StringBuilder builder = new StringBuilder();
		if (violation.contractName() != null && !violation.contractName().isBlank()) {
			builder.append(violation.contractName()).append(" - ");
		}
		builder.append(violation.message());
		if (violation.sourcePath() != null) {
			builder.append(" [").append(violation.sourcePath()).append("]");
		}
		return builder.toString();
	}
}
