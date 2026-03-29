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
package sh.stubborn.oss.security;

import io.github.resilience4j.ratelimiter.RateLimiterRegistry;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Registers the {@link RateLimitFilter} when a {@link RateLimiterRegistry} bean is
 * available. In {@code @WebMvcTest} contexts without Resilience4j auto-configuration, the
 * filter is not created.
 *
 * @see RateLimitFilter
 * @see <a href="docs/specs/038-security-hardening.md">Spec 038</a>
 */
@Configuration
class RateLimitFilterConfig {

	@Bean
	RateLimitFilter rateLimitFilter(RateLimiterRegistry rateLimiterRegistry) {
		return new RateLimitFilter(rateLimiterRegistry);
	}

}
