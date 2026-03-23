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
package sh.stubborn.broker.environment;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.micrometer.tracing.test.autoconfigure.AutoConfigureTracing;
import org.springframework.boot.restdocs.test.autoconfigure.AutoConfigureRestDocs;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.restdocs.mockmvc.RestDocumentationResultHandler;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.springframework.cloud.contract.wiremock.restdocs.SpringCloudContractRestDocs.dslContract;
import static org.springframework.restdocs.mockmvc.MockMvcRestDocumentation.document;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Tag("generate-stubs")
@WebMvcTest(DeploymentController.class)
@AutoConfigureTracing
@AutoConfigureRestDocs
@WithMockUser(roles = "ADMIN")
class DeploymentContractTest {

	@Autowired
	MockMvc mockMvc;

	@MockitoBean
	DeploymentService deploymentService;

	@Test
	void should_record_deployment() throws Exception {
		// given
		UUID applicationId = UUID.randomUUID();
		Deployment deployment = Deployment.create(applicationId, "staging", "1.0.0");
		given(this.deploymentService.recordDeployment("staging", "order-service", "1.0.0")).willReturn(deployment);

		// when/then
		this.mockMvc
			.perform(
					post("/api/v1/environments/staging/deployments").contentType(MediaType.APPLICATION_JSON).content("""
							{
							  "applicationName": "order-service",
							  "version": "1.0.0"
							}
							"""))
			.andExpect(status().isCreated())
			.andExpect(header().string("Location", "/api/v1/environments/staging/deployments/order-service"))
			.andDo(contractDocument("record-deployment"));
	}

	@Test
	void should_list_deployments_by_environment() throws Exception {
		// given
		UUID appId = UUID.randomUUID();
		Deployment d = Deployment.create(appId, "staging", "1.0.0");
		given(this.deploymentService.findResponsesByEnvironment(eq("staging"), any(Pageable.class)))
			.willReturn(new PageImpl<>(List.of(DeploymentResponse.from(d, "order-service"))));

		// when/then
		this.mockMvc.perform(get("/api/v1/environments/staging/deployments"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.content", hasSize(1)))
			.andDo(contractDocument("list-deployments"));
	}

	@Test
	void should_get_deployment_by_application() throws Exception {
		// given
		UUID appId = UUID.randomUUID();
		Deployment d = Deployment.create(appId, "staging", "1.0.0");
		given(this.deploymentService.findByEnvironmentAndApplication("staging", "order-service")).willReturn(d);

		// when/then
		this.mockMvc.perform(get("/api/v1/environments/staging/deployments/order-service"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.version").value("1.0.0"))
			.andDo(contractDocument("get-deployment"));
	}

	private static RestDocumentationResultHandler contractDocument(String identifier) {
		return document(identifier, dslContract());
	}

}
