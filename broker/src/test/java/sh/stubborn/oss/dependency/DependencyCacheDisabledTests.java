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
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import sh.stubborn.oss.application.ApplicationService;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.support.NoOpCacheManager;
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
 * The same service with caching switched off, as {@code spring.cache.type=none} leaves
 * it. Answers must stay correct when nothing is cached — a service that only behaves when
 * a cache is in front of it is a service that is wrong.
 */
@SpringJUnitConfig(DependencyCacheDisabledTests.NoCachingConfig.class)
class DependencyCacheDisabledTests {

	@Autowired
	DependencyService dependencyService;

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
	}

	@Test
	void should_read_through_to_the_repository_on_every_call() {
		// given
		given(this.dependencyRepository.findDistinctConsumerIdsByProviderId(this.providerId))
			.willReturn(List.of(this.consumerId));

		// when
		this.dependencyService.findConsumerIdsByProviderId(this.providerId);
		this.dependencyService.findConsumerIdsByProviderId(this.providerId);

		// then — nothing is remembered, so both calls hit the repository
		verify(this.dependencyRepository, times(2)).findDistinctConsumerIdsByProviderId(this.providerId);
	}

	@Test
	void should_still_return_the_right_consumers_without_a_cache() {
		// given
		given(this.dependencyRepository.findDistinctConsumerIdsByProviderId(this.providerId))
			.willReturn(List.of(this.consumerId));

		// when / then
		assertThat(this.dependencyService.findConsumerIdsByProviderId(this.providerId))
			.containsExactly(this.consumerId);
	}

	@Test
	void should_declare_a_dependency_without_a_cache_to_evict() {
		// given — @CacheEvict against a no-op manager must not blow up
		given(this.applicationService.findIdByName("consumer-a")).willReturn(this.consumerId);
		given(this.applicationService.findIdByName("provider-a")).willReturn(this.providerId);
		given(this.dependencyRepository.findByConsumerIdAndConsumerVersionAndProviderId(this.consumerId, "1.0.0",
				this.providerId))
			.willReturn(Optional.empty());
		given(this.dependencyRepository.save(any(Dependency.class)))
			.willAnswer((invocation) -> invocation.getArgument(0));

		// when
		DependencyInfo info = this.dependencyService.declare("consumer-a", "1.0.0", "provider-a",
				DependencySource.DECLARED);

		// then
		assertThat(info.consumerId()).isEqualTo(this.consumerId);
		assertThat(info.providerId()).isEqualTo(this.providerId);
	}

	@Configuration(proxyBeanMethods = false)
	@EnableCaching
	static class NoCachingConfig {

		@Bean
		CacheManager cacheManager() {
			return new NoOpCacheManager();
		}

		@Bean
		DependencyService dependencyService(DependencyRepository dependencyRepository,
				ApplicationService applicationService) {
			return new DependencyService(dependencyRepository, applicationService);
		}

	}

}
