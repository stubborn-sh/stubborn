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
package sh.stubborn.broker.safety;

import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * Strategy interface for evaluating consumer safety during deployment checks. The OSS
 * implementation performs direct version-to-version matching. A Pro implementation may
 * add branch-aware filtering, pending pact support, or other advanced strategies.
 */
public interface DeploymentSafetyChecker {

	/**
	 * Evaluate all consumers deployed to the given environment and determine whether each
	 * has a successful verification against the provider version.
	 * @param providerId the provider application ID
	 * @param providerVersion the provider version to check
	 * @param environment the target deployment environment
	 * @param branch optional branch filter (ignored in OSS)
	 * @return list of consumer evaluation results
	 */
	List<ConsumerResult> evaluateConsumers(UUID providerId, String providerVersion, String environment,
			@Nullable String branch);

}
