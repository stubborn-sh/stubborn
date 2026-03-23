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
package sh.stubborn.broker.matrix;

import java.util.List;

import io.micrometer.observation.annotation.Observed;
import org.jspecify.annotations.Nullable;

import org.springframework.cache.annotation.Cacheable;
import sh.stubborn.broker.application.ApplicationService;
import sh.stubborn.broker.verification.VerificationService;
import org.springframework.stereotype.Service;

@Service
public class MatrixService {

	private final VerificationService verificationService;

	private final ApplicationService applicationService;

	MatrixService(VerificationService verificationService, ApplicationService applicationService) {
		this.verificationService = verificationService;
		this.applicationService = applicationService;
	}

	@Observed(name = "broker.matrix.query")
	@Cacheable(cacheNames = "matrix",
			key = "'query:' + (#providerName != null ? #providerName : '') + ':' + (#consumerName != null ? #consumerName : '')")
	public List<MatrixEntry> query(@Nullable String providerName, @Nullable String consumerName) {
		return this.verificationService.findAllInfo().stream().filter(v -> {
			if (providerName != null) {
				String name = this.applicationService.findNameById(v.providerId());
				if (!name.equals(providerName)) {
					return false;
				}
			}
			if (consumerName != null) {
				String name = this.applicationService.findNameById(v.consumerId());
				if (!name.equals(consumerName)) {
					return false;
				}
			}
			return true;
		}).map(v -> {
			String provider = this.applicationService.findNameById(v.providerId());
			String consumer = this.applicationService.findNameById(v.consumerId());
			return new MatrixEntry(provider, v.providerVersion(), consumer, v.consumerVersion(), v.status(), v.branch(),
					v.verifiedAt());
		}).toList();
	}

}
