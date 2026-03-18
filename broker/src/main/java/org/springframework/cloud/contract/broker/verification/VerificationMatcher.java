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
package org.springframework.cloud.contract.broker.verification;

import java.util.UUID;

/**
 * Strategy interface for determining whether a successful verification exists between a
 * provider and consumer version pair. The OSS implementation performs direct
 * version-to-version matching. A Pro implementation may add content-hash based matching,
 * pending pact support, or other advanced strategies.
 */
public interface VerificationMatcher {

	/**
	 * Check whether a successful verification exists for the given provider-consumer
	 * version pair.
	 * @param providerId the provider application ID
	 * @param providerVersion the provider version
	 * @param consumerId the consumer application ID
	 * @param consumerVersion the consumer version
	 * @return true if a successful verification exists
	 */
	boolean hasSuccessfulVerification(UUID providerId, String providerVersion, UUID consumerId, String consumerVersion);

}
