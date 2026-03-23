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
package sh.stubborn.broker.security;

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

import sh.stubborn.broker.application.ApplicationService;
import sh.stubborn.broker.contract.ContractService;
import sh.stubborn.broker.environment.DeploymentService;
import sh.stubborn.broker.environment.EnvironmentService;
import sh.stubborn.broker.graph.DependencyGraphService;
import sh.stubborn.broker.safety.CanIDeployService;
import sh.stubborn.broker.verification.VerificationService;
import sh.stubborn.broker.maintenance.CleanupService;
import sh.stubborn.broker.mavenimport.MavenImportService;
import sh.stubborn.broker.matrix.MatrixService;
import sh.stubborn.broker.selector.SelectorService;
import sh.stubborn.broker.spi.BrokerLicenseChecker;
import sh.stubborn.broker.tag.TagService;
import sh.stubborn.broker.webhook.WebhookService;
import org.springframework.test.context.TestPropertySource;

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
	@org.springframework.test.context.bean.override.mockito.MockitoBean
	ApplicationService applicationService;

	@SuppressWarnings("unused")
	@org.springframework.test.context.bean.override.mockito.MockitoBean
	ContractService contractService;

	@SuppressWarnings("unused")
	@org.springframework.test.context.bean.override.mockito.MockitoBean
	VerificationService verificationService;

	@SuppressWarnings("unused")
	@org.springframework.test.context.bean.override.mockito.MockitoBean
	DeploymentService deploymentService;

	@SuppressWarnings("unused")
	@org.springframework.test.context.bean.override.mockito.MockitoBean
	CanIDeployService canIDeployService;

	@SuppressWarnings("unused")
	@org.springframework.test.context.bean.override.mockito.MockitoBean
	DependencyGraphService dependencyGraphService;

	@SuppressWarnings("unused")
	@org.springframework.test.context.bean.override.mockito.MockitoBean
	WebhookService webhookService;

	@SuppressWarnings("unused")
	@org.springframework.test.context.bean.override.mockito.MockitoBean
	MatrixService matrixService;

	@SuppressWarnings("unused")
	@org.springframework.test.context.bean.override.mockito.MockitoBean
	SelectorService selectorService;

	@SuppressWarnings("unused")
	@org.springframework.test.context.bean.override.mockito.MockitoBean
	TagService tagService;

	@SuppressWarnings("unused")
	@org.springframework.test.context.bean.override.mockito.MockitoBean
	CleanupService cleanupService;

	@SuppressWarnings("unused")
	@org.springframework.test.context.bean.override.mockito.MockitoBean
	EnvironmentService environmentService;

	@SuppressWarnings("unused")
	@org.springframework.test.context.bean.override.mockito.MockitoBean
	MavenImportService mavenImportService;

	@SuppressWarnings("unused")
	@org.springframework.test.context.bean.override.mockito.MockitoBean
	BrokerLicenseChecker brokerLicenseChecker;

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
