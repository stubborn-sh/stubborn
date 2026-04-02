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

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.micrometer.tracing.test.autoconfigure.AutoConfigureTracing;
import org.springframework.boot.restdocs.test.autoconfigure.AutoConfigureRestDocs;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.restdocs.mockmvc.RestDocumentationResultHandler;
import org.springframework.test.web.servlet.MockMvc;

import sh.stubborn.oss.application.ApplicationService;
import sh.stubborn.oss.contract.ContractService;
import sh.stubborn.oss.environment.DeploymentService;
import sh.stubborn.oss.environment.EnvironmentService;
import sh.stubborn.oss.graph.DependencyGraphService;
import sh.stubborn.oss.safety.CanIDeployService;
import sh.stubborn.oss.verification.VerificationService;
import sh.stubborn.oss.maintenance.CleanupService;
import sh.stubborn.oss.gitimport.GitImportService;
import sh.stubborn.oss.mavenimport.MavenImportService;
import sh.stubborn.oss.matrix.MatrixService;
import sh.stubborn.oss.selector.SelectorService;
import sh.stubborn.oss.mavenimport.MavenStubsDiscoveryService;
import sh.stubborn.oss.audit.AuditService;
import sh.stubborn.oss.spi.BrokerLicenseChecker;
import sh.stubborn.oss.tag.TagService;
import sh.stubborn.oss.topic.TopicTopologyService;
import sh.stubborn.oss.webhook.WebhookService;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import static org.springframework.cloud.contract.wiremock.restdocs.SpringCloudContractRestDocs.dslContract;
import static org.springframework.restdocs.mockmvc.MockMvcRestDocumentation.document;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Contract tests for security-related API responses (401 Unauthorized). No
 * {@code @WithMockUser} — requests are unauthenticated. Uses {@code @WebMvcTest} (all
 * controllers) with explicit {@link SecurityConfig} import to test the custom
 * authentication entry point.
 */
@Tag("generate-stubs")
@WebMvcTest
@Import(SecurityConfig.class)
@AutoConfigureTracing
@AutoConfigureRestDocs
@TestPropertySource(properties = "broker.pro.enabled=true")
class SecurityContractTest {

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

	@Test
	void should_return_401_when_not_authenticated() throws Exception {
		// when/then — no authentication, Spring Security returns 401
		this.mockMvc.perform(post("/api/v1/applications").contentType(MediaType.APPLICATION_JSON).content("""
				{"name": "unauthenticated-service", "description": "Manages orders", "owner": "team-commerce"}
				"""))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
			.andDo(contractDocument("register-application-unauthorized"));
	}

	private static RestDocumentationResultHandler contractDocument(String identifier) {
		return document(identifier, dslContract());
	}

}
