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

import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import static org.assertj.core.api.Assertions.assertThat;
import org.springframework.boot.micrometer.tracing.test.autoconfigure.AutoConfigureTracing;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import sh.stubborn.oss.application.ApplicationService;
import sh.stubborn.oss.contract.ContractService;
import sh.stubborn.oss.environment.DeploymentService;
import sh.stubborn.oss.environment.EnvironmentService;
import sh.stubborn.oss.graph.DependencyGraphService;
import sh.stubborn.oss.maintenance.CleanupService;
import sh.stubborn.oss.gitimport.GitImportService;
import sh.stubborn.oss.mavenimport.MavenImportService;
import sh.stubborn.oss.matrix.MatrixService;
import sh.stubborn.oss.safety.CanIDeployService;
import sh.stubborn.oss.selector.SelectorService;
import sh.stubborn.oss.mavenimport.MavenStubsDiscoveryService;
import sh.stubborn.oss.spi.BrokerLicenseChecker;
import sh.stubborn.oss.tag.TagService;
import sh.stubborn.oss.verification.VerificationService;
import sh.stubborn.oss.webhook.WebhookService;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import sh.stubborn.oss.audit.AuditService;
import sh.stubborn.oss.topic.TopicTopologyService;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Surefire unit test for RBAC rules in {@link SecurityConfig}. Verifies that each role
 * (READER, PUBLISHER, ADMIN) has the expected access to API endpoints. Uses
 * {@code @WebMvcTest} (all controllers) with {@code httpBasic} authentication — fast, no
 * Docker. Complements the Failsafe {@code SecurityMatrixE2ETest}.
 */
@WebMvcTest
@Import({ SecurityConfig.class, UserConfig.class })
@AutoConfigureTracing
@TestPropertySource(properties = "broker.pro.enabled=true")
class SecurityRbacTest {

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

	@SuppressWarnings("unused")
	@MockitoBean
	TopicTopologyService topicTopologyService;

	// --- READER role ---

	@Test
	void should_allow_reader_to_get_applications() throws Exception {
		// Not 401/403 — READER is authorized for GET
		int status = this.mockMvc.perform(get("/api/v1/applications").with(httpBasic("reader", "reader")))
			.andReturn()
			.getResponse()
			.getStatus();
		assertThat(status).isNotIn(401, 403);
	}

	@Test
	void should_deny_reader_to_post_applications() throws Exception {
		this.mockMvc
			.perform(post("/api/v1/applications").with(httpBasic("reader", "reader"))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"test\"}"))
			.andExpect(status().isForbidden());
	}

	@Test
	void should_deny_reader_to_delete_applications() throws Exception {
		this.mockMvc.perform(delete("/api/v1/applications/test-app").with(httpBasic("reader", "reader")))
			.andExpect(status().isForbidden());
	}

	@Test
	void should_deny_reader_to_post_verifications() throws Exception {
		this.mockMvc
			.perform(post("/api/v1/verifications").with(httpBasic("reader", "reader"))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{}"))
			.andExpect(status().isForbidden());
	}

	@Test
	void should_allow_reader_to_get_environments() throws Exception {
		int status = this.mockMvc.perform(get("/api/v1/environments").with(httpBasic("reader", "reader")))
			.andReturn()
			.getResponse()
			.getStatus();
		assertThat(status).isNotIn(401, 403);
	}

	@Test
	void should_deny_reader_to_post_environments() throws Exception {
		this.mockMvc
			.perform(post("/api/v1/environments").with(httpBasic("reader", "reader"))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"staging\",\"description\":\"test\",\"displayOrder\":0,\"production\":false}"))
			.andExpect(status().isForbidden());
	}

	@Test
	void should_deny_reader_to_delete_environments() throws Exception {
		this.mockMvc.perform(delete("/api/v1/environments/staging").with(httpBasic("reader", "reader")))
			.andExpect(status().isForbidden());
	}

	// --- PUBLISHER role ---

	@Test
	void should_allow_publisher_to_get_applications() throws Exception {
		// Not 401/403 — PUBLISHER is authorized for GET
		int status = this.mockMvc.perform(get("/api/v1/applications").with(httpBasic("publisher", "publisher")))
			.andReturn()
			.getResponse()
			.getStatus();
		assertThat(status).isNotIn(401, 403);
	}

	@Test
	void should_deny_publisher_to_post_applications() throws Exception {
		this.mockMvc
			.perform(post("/api/v1/applications").with(httpBasic("publisher", "publisher"))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"test\"}"))
			.andExpect(status().isForbidden());
	}

	@Test
	void should_deny_publisher_to_delete_applications() throws Exception {
		this.mockMvc.perform(delete("/api/v1/applications/test-app").with(httpBasic("publisher", "publisher")))
			.andExpect(status().isForbidden());
	}

	@Test
	void should_allow_publisher_to_post_verifications() throws Exception {
		// PUBLISHER can post verifications — returns 400 because body is invalid, not 403
		this.mockMvc
			.perform(post("/api/v1/verifications").with(httpBasic("publisher", "publisher"))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{}"))
			.andExpect(status().isBadRequest());
	}

	// --- ADMIN role ---

	@Test
	void should_allow_admin_to_get_applications() throws Exception {
		// Not 401/403 — ADMIN is authorized for GET
		int status = this.mockMvc.perform(get("/api/v1/applications").with(httpBasic("admin", "admin")))
			.andReturn()
			.getResponse()
			.getStatus();
		assertThat(status).isNotIn(401, 403);
	}

	@Test
	void should_allow_admin_to_post_applications() throws Exception {
		// ADMIN can create — returns 400 because body is incomplete, not 403
		this.mockMvc
			.perform(post("/api/v1/applications").with(httpBasic("admin", "admin"))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"test\"}"))
			.andExpect(status().isBadRequest());
	}

	@Test
	void should_allow_admin_to_delete_applications() throws Exception {
		// Not 401/403 — ADMIN is authorized for DELETE
		int status = this.mockMvc.perform(delete("/api/v1/applications/nonexistent").with(httpBasic("admin", "admin")))
			.andReturn()
			.getResponse()
			.getStatus();
		assertThat(status).isNotIn(401, 403);
	}

	// --- Unauthenticated ---

	@Test
	void should_deny_unauthenticated_access_to_api() throws Exception {
		this.mockMvc.perform(get("/api/v1/applications")).andExpect(status().isUnauthorized());
	}

	@Test
	void should_allow_unauthenticated_health_check() throws Exception {
		this.mockMvc.perform(get("/actuator/health")).andExpect(status().isOk());
	}

	@Test
	void should_allow_unauthenticated_broker_info() throws Exception {
		int status = this.mockMvc.perform(get("/api/v1/broker/info")).andReturn().getResponse().getStatus();
		assertThat(status).isNotIn(401, 403);
	}

}
