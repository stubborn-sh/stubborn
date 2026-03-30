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

import java.time.Duration;

import io.github.resilience4j.ratelimiter.RateLimiterConfig;
import io.github.resilience4j.ratelimiter.RateLimiterRegistry;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.micrometer.tracing.test.autoconfigure.AutoConfigureTracing;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import sh.stubborn.oss.application.ApplicationService;
import sh.stubborn.oss.audit.AuditService;
import sh.stubborn.oss.contract.ContractService;
import sh.stubborn.oss.environment.DeploymentService;
import sh.stubborn.oss.environment.EnvironmentService;
import sh.stubborn.oss.gitimport.GitImportService;
import sh.stubborn.oss.graph.DependencyGraphService;
import sh.stubborn.oss.maintenance.CleanupService;
import sh.stubborn.oss.matrix.MatrixService;
import sh.stubborn.oss.mavenimport.MavenImportService;
import sh.stubborn.oss.mavenimport.MavenStubsDiscoveryService;
import sh.stubborn.oss.safety.CanIDeployService;
import sh.stubborn.oss.selector.SelectorService;
import sh.stubborn.oss.spi.BrokerLicenseChecker;
import sh.stubborn.oss.tag.TagService;
import sh.stubborn.oss.verification.VerificationService;
import sh.stubborn.oss.webhook.WebhookService;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tests for security hardening measures: CORS headers, security headers (HSTS, CSP,
 * X-Frame-Options), contract content size validation, rate limiting, and pagination max
 * size.
 *
 * @see SecurityConfig
 * @see RateLimitFilter
 * @see <a href="docs/specs/038-security-hardening.md">Spec 038</a>
 */
@WebMvcTest
@Import({ SecurityConfig.class, UserConfig.class, RateLimitFilterConfig.class,
		SecurityHardeningTest.TestRateLimiterConfig.class })
@AutoConfigureTracing
@TestPropertySource(properties = { "broker.pro.enabled=true", "spring.data.web.pageable.max-page-size=1000" })
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class SecurityHardeningTest {

	@Autowired
	MockMvc mockMvc;

	@SuppressWarnings("unused")
	@MockitoBean
	ApplicationService applicationService;

	@SuppressWarnings("unused")
	@MockitoBean
	ContractService contractService;

	@SuppressWarnings("unused")
	@MockitoBean
	VerificationService verificationService;

	@SuppressWarnings("unused")
	@MockitoBean
	DeploymentService deploymentService;

	@SuppressWarnings("unused")
	@MockitoBean
	CanIDeployService canIDeployService;

	@SuppressWarnings("unused")
	@MockitoBean
	DependencyGraphService dependencyGraphService;

	@SuppressWarnings("unused")
	@MockitoBean
	WebhookService webhookService;

	@SuppressWarnings("unused")
	@MockitoBean
	MatrixService matrixService;

	@SuppressWarnings("unused")
	@MockitoBean
	SelectorService selectorService;

	@SuppressWarnings("unused")
	@MockitoBean
	TagService tagService;

	@SuppressWarnings("unused")
	@MockitoBean
	CleanupService cleanupService;

	@SuppressWarnings("unused")
	@MockitoBean
	EnvironmentService environmentService;

	@SuppressWarnings("unused")
	@MockitoBean
	MavenImportService mavenImportService;

	@SuppressWarnings("unused")
	@MockitoBean
	GitImportService gitImportService;

	@SuppressWarnings("unused")
	@MockitoBean
	BrokerLicenseChecker brokerLicenseChecker;

	@SuppressWarnings("unused")
	@MockitoBean
	MavenStubsDiscoveryService mavenStubsDiscoveryService;

	@SuppressWarnings("unused")
	@MockitoBean
	CredentialEncryptionService credentialEncryptionService;

	@SuppressWarnings("unused")
	@MockitoBean
	AuditService auditService;

	/**
	 * Provides a {@link RateLimiterRegistry} with a tight limit (20 per 60s) for testing
	 * rate limiting behavior.
	 */
	@Configuration
	static class TestRateLimiterConfig {

		@Bean
		RateLimiterRegistry rateLimiterRegistry() {
			RateLimiterConfig config = RateLimiterConfig.custom()
				.limitForPeriod(100)
				.limitRefreshPeriod(Duration.ofSeconds(60))
				.timeoutDuration(Duration.ZERO)
				.build();
			return RateLimiterRegistry.of(config);
		}

	}

	// --- Security headers ---

	@Test
	@Order(1)
	void should_include_x_frame_options_deny_header() throws Exception {
		this.mockMvc.perform(get("/api/v1/broker/info")).andExpect(header().string("X-Frame-Options", "DENY"));
	}

	@Test
	@Order(2)
	void should_include_content_security_policy_header() throws Exception {
		this.mockMvc.perform(get("/api/v1/broker/info"))
			.andExpect(header().string("Content-Security-Policy", "default-src 'self'; script-src 'self'"));
	}

	@Test
	@Order(3)
	void should_include_strict_transport_security_header() throws Exception {
		// HSTS header is only sent over HTTPS, so use secure request
		this.mockMvc.perform(get("/api/v1/broker/info").secure(true))
			.andExpect(header().string("Strict-Transport-Security", "max-age=31536000 ; includeSubDomains"));
	}

	// --- CORS ---

	@Test
	@Order(4)
	void should_return_cors_headers_for_any_origin() throws Exception {
		this.mockMvc
			.perform(options("/api/v1/applications").header("Origin", "https://stubborn.sh")
				.header("Access-Control-Request-Method", "GET"))
			.andExpect(header().string("Access-Control-Allow-Origin", "*"));
	}

	@Test
	@Order(5)
	void should_allow_cors_for_external_origins() throws Exception {
		this.mockMvc
			.perform(options("/api/v1/applications").header("Origin", "https://custom-install.example.com")
				.header("Access-Control-Request-Method", "GET"))
			.andExpect(header().string("Access-Control-Allow-Origin", "*"));
	}

	// --- Rate limiting ---

	@Test
	@Order(99)
	void should_return_429_when_rate_limit_exceeded() throws Exception {
		// given - exhaust remaining rate limit permits (configured to 100 per 60s in
		// TestRateLimiterConfig; some may already be consumed by preceding tests).
		int rateLimited = 0;
		for (int i = 0; i < 110; i++) {
			int statusCode = this.mockMvc.perform(get("/api/v1/broker/info")).andReturn().getResponse().getStatus();
			if (statusCode == 429) {
				rateLimited++;
			}
		}

		// then - at least one request must have been rate-limited
		assertThat(rateLimited).as("Expected at least one 429 response after exhausting rate limit").isGreaterThan(0);
	}

}
