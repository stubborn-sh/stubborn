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
package sh.stubborn.broker.verification;

import java.util.UUID;

/**
 * OSS default implementation of {@link VerificationMatcher}. Performs direct
 * version-to-version matching by querying the verification repository for an exact match.
 */
class DirectVerificationMatcher implements VerificationMatcher {

	private final VerificationRepository verificationRepository;

	DirectVerificationMatcher(VerificationRepository verificationRepository) {
		this.verificationRepository = verificationRepository;
	}

	@Override
	public boolean hasSuccessfulVerification(UUID providerId, String providerVersion, UUID consumerId,
			String consumerVersion) {
		return this.verificationRepository.existsByProviderIdAndProviderVersionAndConsumerIdAndConsumerVersionAndStatus(
				providerId, providerVersion, consumerId, consumerVersion, VerificationStatus.SUCCESS);
	}

}
