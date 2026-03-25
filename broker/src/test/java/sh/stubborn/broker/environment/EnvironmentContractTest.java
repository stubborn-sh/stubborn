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

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.micrometer.tracing.test.autoconfigure.AutoConfigureTracing;
import org.springframework.boot.restdocs.test.autoconfigure.AutoConfigureRestDocs;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.restdocs.mockmvc.RestDocumentationResultHandler;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.hasSize;
import static org.mockito.BDDMockito.given;
import static org.springframework.cloud.contract.wiremock.restdocs.SpringCloudContractRestDocs.dslContract;
import static org.springframework.restdocs.mockmvc.MockMvcRestDocumentation.document;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Tag("generate-stubs")
@WebMvcTest(EnvironmentController.class)
@AutoConfigureTracing
@AutoConfigureRestDocs
@WithMockUser(roles = "ADMIN")
class EnvironmentContractTest {

	@Autowired
	MockMvc mockMvc;

	@MockitoBean
	EnvironmentService environmentService;

	@Test
	void should_create_environment() throws Exception {
		// given
		Environment env = Environment.create("staging", "Staging environment", 1, false);
		given(this.environmentService.create("staging", "Staging environment", 1, false)).willReturn(env);

		// when/then
		this.mockMvc.perform(post("/api/v1/environments").contentType(MediaType.APPLICATION_JSON).content("""
				{"name": "staging", "description": "Staging environment", "displayOrder": 1, "production": false}
				"""))
			.andExpect(status().isCreated())
			.andExpect(header().string("Location", "/api/v1/environments/staging"))
			.andExpect(jsonPath("$.name").value("staging"))
			.andDo(contractDocument("create-environment"));
	}

	@Test
	void should_list_environments() throws Exception {
		// given
		Environment staging = Environment.create("staging", "Staging environment", 1, false);
		Environment production = Environment.create("production", "Production environment", 2, true);
		given(this.environmentService.findAll()).willReturn(List.of(staging, production));

		// when/then
		this.mockMvc.perform(get("/api/v1/environments"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(2)))
			.andExpect(jsonPath("$[0].name").value("staging"))
			.andExpect(jsonPath("$[1].name").value("production"))
			.andDo(contractDocument("list-environments"));
	}

	@Test
	void should_get_environment_by_name() throws Exception {
		// given
		Environment env = Environment.create("staging", "Staging environment", 1, false);
		given(this.environmentService.findByName("staging")).willReturn(env);

		// when/then
		this.mockMvc.perform(get("/api/v1/environments/staging"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.name").value("staging"))
			.andExpect(jsonPath("$.production").value(false))
			.andDo(contractDocument("get-environment"));
	}

	private static RestDocumentationResultHandler contractDocument(String identifier) {
		return document(identifier, dslContract());
	}

}
