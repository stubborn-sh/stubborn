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
package sh.stubborn.oss.dependency;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import io.micrometer.observation.annotation.Observed;
import org.jspecify.annotations.Nullable;
import sh.stubborn.oss.application.ApplicationService;
import sh.stubborn.oss.contract.ContractVersion;

import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DependencyService {

	private final DependencyRepository dependencyRepository;

	private final ApplicationService applicationService;

	DependencyService(DependencyRepository dependencyRepository, ApplicationService applicationService) {
		this.dependencyRepository = dependencyRepository;
		this.applicationService = applicationService;
	}

	/**
	 * Record that a consumer version depends on a provider. Idempotent: re-declaring an
	 * existing dependency returns the stored one untouched, so a consumer resolving the
	 * same stubs on every build does not accumulate rows. {@code source} therefore
	 * records how the dependency was first learned of, not how it was last confirmed.
	 * @param consumerName the declaring consumer
	 * @param consumerVersion the consumer version the dependency belongs to
	 * @param providerName the provider being depended on
	 * @param source how the dependency came to be known
	 * @return the stored dependency
	 */
	@Observed(name = "broker.dependency.declare")
	@Transactional
	@Caching(evict = { @CacheEvict(cacheNames = "dependencies", allEntries = true),
			@CacheEvict(cacheNames = "safety", allEntries = true) })
	public DependencyInfo declare(String consumerName, String consumerVersion, String providerName,
			DependencySource source) {
		ContractVersion.of(consumerVersion);
		UUID consumerId = this.applicationService.findIdByName(consumerName);
		UUID providerId = this.applicationService.findIdByName(providerName);
		if (consumerId.equals(providerId)) {
			throw new SelfDependencyException(consumerName);
		}
		return this.dependencyRepository
			.findByConsumerIdAndConsumerVersionAndProviderId(consumerId, consumerVersion, providerId)
			.map(DependencyInfo::from)
			.orElseGet(() -> DependencyInfo.from(this.dependencyRepository
				.save(Dependency.create(consumerId, consumerVersion, providerId, source))));
	}

	/**
	 * Return the applications that have declared a dependency on the given provider, at
	 * any version. Combined with verification history by can-i-deploy, so that a consumer
	 * which has declared its dependency but not yet verified is still evaluated.
	 * @param providerId the provider application ID
	 * @return the IDs of applications that declared a dependency on the provider
	 */
	@Cacheable(cacheNames = "dependencies", key = "'consumerIds:' + #providerId")
	public Set<UUID> findConsumerIdsByProviderId(UUID providerId) {
		return Set.copyOf(this.dependencyRepository.findDistinctConsumerIdsByProviderId(providerId));
	}

	/**
	 * Return the applications the given consumer has declared a dependency on, at any
	 * version. The mirror image of {@link #findConsumerIdsByProviderId(UUID)}, used by
	 * can-i-deploy to find the providers a candidate deployment talks to.
	 * @param consumerId the consumer application ID
	 * @return the IDs of applications the consumer declared a dependency on
	 */
	@Cacheable(cacheNames = "dependencies", key = "'providerIds:' + #consumerId")
	public Set<UUID> findProviderIdsByConsumerId(UUID consumerId) {
		return Set.copyOf(this.dependencyRepository.findDistinctProviderIdsByConsumerId(consumerId));
	}

	List<DependencyInfo> findInfoByConsumer(String consumerName, @Nullable String consumerVersion) {
		UUID consumerId = this.applicationService.findIdByName(consumerName);
		List<Dependency> dependencies = (consumerVersion != null)
				? this.dependencyRepository.findByConsumerIdAndConsumerVersion(consumerId, consumerVersion)
				: this.dependencyRepository.findByConsumerId(consumerId);
		return dependencies.stream().map(DependencyInfo::from).toList();
	}

	String resolveApplicationName(UUID applicationId) {
		return this.applicationService.findNameById(applicationId);
	}

}
