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
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import sh.stubborn.oss.application.ApplicationService;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/**
 * The caching annotations on {@link DependencyService} are Spring AOP, so they do nothing
 * in a plain Mockito unit test. These exercise the service as a proxied bean with a real
 * cache manager, which is the only way the {@code @Cacheable} lookup and the
 * {@code @CacheEvict} on declaring are actually covered.
 */
@SpringJUnitConfig(DependencyCachingTests.CachingConfig.class)
class DependencyCachingTests {

	@Autowired
	DependencyService dependencyService;

	@Autowired
	CacheManager cacheManager;

	@MockitoBean
	DependencyRepository dependencyRepository;

	@MockitoBean
	ApplicationService applicationService;

	UUID providerId;

	UUID consumerId;

	@BeforeEach
	void setUp() {
		this.providerId = UUID.randomUUID();
		this.consumerId = UUID.randomUUID();
		this.cacheManager.getCacheNames()
			.forEach((name) -> Objects.requireNonNull(this.cacheManager.getCache(name)).clear());
	}

	@Test
	void should_read_through_to_the_repository_only_once_for_the_same_provider() {
		// given
		given(this.dependencyRepository.findDistinctConsumerIdsByProviderId(this.providerId))
			.willReturn(List.of(this.consumerId));

		// when — can-i-deploy asks on every check
		this.dependencyService.findConsumerIdsByProviderId(this.providerId);
		this.dependencyService.findConsumerIdsByProviderId(this.providerId);

		// then
		verify(this.dependencyRepository, times(1)).findDistinctConsumerIdsByProviderId(this.providerId);
	}

	@Test
	void should_cache_each_provider_separately() {
		// given — a shared cache entry across providers would answer for the wrong one
		UUID otherProviderId = UUID.randomUUID();
		UUID otherConsumerId = UUID.randomUUID();
		given(this.dependencyRepository.findDistinctConsumerIdsByProviderId(this.providerId))
			.willReturn(List.of(this.consumerId));
		given(this.dependencyRepository.findDistinctConsumerIdsByProviderId(otherProviderId))
			.willReturn(List.of(otherConsumerId));

		// when
		Set<UUID> first = this.dependencyService.findConsumerIdsByProviderId(this.providerId);
		Set<UUID> second = this.dependencyService.findConsumerIdsByProviderId(otherProviderId);

		// then
		assertThat(first).containsExactly(this.consumerId);
		assertThat(second).containsExactly(otherConsumerId);
		verify(this.dependencyRepository).findDistinctConsumerIdsByProviderId(this.providerId);
		verify(this.dependencyRepository).findDistinctConsumerIdsByProviderId(otherProviderId);
	}

	@Test
	void should_read_through_to_the_repository_only_once_for_the_same_consumer() {
		// given — can-i-deploy asks for the providers of the candidate on every check
		given(this.dependencyRepository.findDistinctProviderIdsByConsumerId(this.consumerId))
			.willReturn(List.of(this.providerId));

		// when
		this.dependencyService.findProviderIdsByConsumerId(this.consumerId);
		this.dependencyService.findProviderIdsByConsumerId(this.consumerId);

		// then
		verify(this.dependencyRepository, times(1)).findDistinctProviderIdsByConsumerId(this.consumerId);
	}

	@Test
	void should_keep_the_two_directions_on_separate_cache_keys() {
		// given — the same application id is both a provider and a consumer, so a shared
		// key would answer one direction with the other direction's edges
		UUID middleId = UUID.randomUUID();
		given(this.dependencyRepository.findDistinctConsumerIdsByProviderId(middleId))
			.willReturn(List.of(this.consumerId));
		given(this.dependencyRepository.findDistinctProviderIdsByConsumerId(middleId))
			.willReturn(List.of(this.providerId));

		// when
		Set<UUID> consumers = this.dependencyService.findConsumerIdsByProviderId(middleId);
		Set<UUID> providers = this.dependencyService.findProviderIdsByConsumerId(middleId);

		// then
		assertThat(consumers).containsExactly(this.consumerId);
		assertThat(providers).containsExactly(this.providerId);
	}

	@Test
	void should_evict_the_cached_providers_when_a_dependency_is_declared() {
		// given — a cached answer that predates the new declaration
		given(this.dependencyRepository.findDistinctProviderIdsByConsumerId(this.consumerId)).willReturn(List.of());
		assertThat(this.dependencyService.findProviderIdsByConsumerId(this.consumerId)).isEmpty();
		givenDeclarationSucceeds();

		// when
		this.dependencyService.declare("consumer-a", "1.0.0", "provider-a", DependencySource.DECLARED);
		given(this.dependencyRepository.findDistinctProviderIdsByConsumerId(this.consumerId))
			.willReturn(List.of(this.providerId));

		// then — the next check sees the new provider rather than the stale empty answer
		assertThat(this.dependencyService.findProviderIdsByConsumerId(this.consumerId))
			.containsExactly(this.providerId);
		verify(this.dependencyRepository, times(2)).findDistinctProviderIdsByConsumerId(this.consumerId);
	}

	@Test
	void should_evict_the_cached_consumers_when_a_dependency_is_declared() {
		// given — a cached answer that predates the new declaration
		given(this.dependencyRepository.findDistinctConsumerIdsByProviderId(this.providerId)).willReturn(List.of());
		assertThat(this.dependencyService.findConsumerIdsByProviderId(this.providerId)).isEmpty();
		givenDeclarationSucceeds();

		// when
		this.dependencyService.declare("consumer-a", "1.0.0", "provider-a", DependencySource.DECLARED);
		given(this.dependencyRepository.findDistinctConsumerIdsByProviderId(this.providerId))
			.willReturn(List.of(this.consumerId));

		// then — the next check sees the new consumer rather than the stale empty answer
		assertThat(this.dependencyService.findConsumerIdsByProviderId(this.providerId))
			.containsExactly(this.consumerId);
		verify(this.dependencyRepository, times(2)).findDistinctConsumerIdsByProviderId(this.providerId);
	}

	@Test
	void should_evict_the_safety_cache_when_a_dependency_is_declared() {
		// given — a previously computed can-i-deploy answer, which a new dependency
		// invalidates: the provider may no longer be safe to deploy
		Cache safety = Objects.requireNonNull(this.cacheManager.getCache("safety"));
		safety.put("check:provider-a:1.0.0:staging:", "stale");

		// when
		givenDeclarationSucceeds();
		this.dependencyService.declare("consumer-a", "1.0.0", "provider-a", DependencySource.DECLARED);

		// then
		assertThat(safety.get("check:provider-a:1.0.0:staging:")).isNull();
	}

	private void givenDeclarationSucceeds() {
		given(this.applicationService.findIdByName("consumer-a")).willReturn(this.consumerId);
		given(this.applicationService.findIdByName("provider-a")).willReturn(this.providerId);
		given(this.dependencyRepository.findByConsumerIdAndConsumerVersionAndProviderId(this.consumerId, "1.0.0",
				this.providerId))
			.willReturn(Optional.empty());
		given(this.dependencyRepository.save(any(Dependency.class)))
			.willAnswer((invocation) -> invocation.getArgument(0));
	}

	@Configuration(proxyBeanMethods = false)
	@EnableCaching
	static class CachingConfig {

		@Bean
		CacheManager cacheManager() {
			return new ConcurrentMapCacheManager("dependencies", "safety");
		}

		@Bean
		DependencyService dependencyService(DependencyRepository dependencyRepository,
				ApplicationService applicationService) {
			return new DependencyService(dependencyRepository, applicationService);
		}

	}

}
