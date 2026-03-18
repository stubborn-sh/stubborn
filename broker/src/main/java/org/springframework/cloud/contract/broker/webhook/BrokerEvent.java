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
package org.springframework.cloud.contract.broker.webhook;

import java.util.Map;
import java.util.UUID;

public record BrokerEvent(EventType eventType, UUID applicationId, String applicationName,
		Map<String, String> payload) {

	public static BrokerEvent contractPublished(UUID applicationId, String applicationName, String version,
			String contractName) {
		return new BrokerEvent(EventType.CONTRACT_PUBLISHED, applicationId, applicationName,
				Map.of("version", version, "contractName", contractName));
	}

	public static BrokerEvent verificationSucceeded(UUID providerId, String providerName, String providerVersion,
			String consumerName) {
		return new BrokerEvent(EventType.VERIFICATION_SUCCEEDED, providerId, providerName,
				Map.of("providerVersion", providerVersion, "consumerName", consumerName));
	}

	public static BrokerEvent verificationFailed(UUID providerId, String providerName, String providerVersion,
			String consumerName) {
		return new BrokerEvent(EventType.VERIFICATION_FAILED, providerId, providerName,
				Map.of("providerVersion", providerVersion, "consumerName", consumerName));
	}

	public static BrokerEvent verificationPublished(UUID providerId, String providerName, String providerVersion,
			String consumerName, String status) {
		return new BrokerEvent(EventType.VERIFICATION_PUBLISHED, providerId, providerName,
				Map.of("providerVersion", providerVersion, "consumerName", consumerName, "status", status));
	}

	public static BrokerEvent deploymentRecorded(UUID applicationId, String applicationName, String version,
			String environment) {
		return new BrokerEvent(EventType.DEPLOYMENT_RECORDED, applicationId, applicationName,
				Map.of("version", version, "environment", environment));
	}

}
