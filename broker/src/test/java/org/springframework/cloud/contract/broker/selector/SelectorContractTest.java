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
package org.springframework.cloud.contract.broker.selector;

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
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.BDDMockito.given;
import static org.springframework.cloud.contract.wiremock.restdocs.SpringCloudContractRestDocs.dslContract;
import static org.springframework.restdocs.mockmvc.MockMvcRestDocumentation.document;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Tag("generate-stubs")
@WebMvcTest(SelectorController.class)
@AutoConfigureTracing
@AutoConfigureRestDocs
@WithMockUser(roles = "READER")
@TestPropertySource(properties = "broker.pro.enabled=true")
class SelectorContractTest {

	@Autowired
	MockMvc mockMvc;

	@MockitoBean
	SelectorService selectorService;

	@Test
	void should_resolve_selectors_by_main_branch() throws Exception {
		// given
		given(this.selectorService.resolve(anyList()))
			.willReturn(List.of(new ResolvedContract("selector-consumer", "2.0.0", "main", "create-order", "abc123")));

		// when/then
		this.mockMvc
			.perform(post("/api/v1/selectors/resolve").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("""
					{"selectors":[{"mainBranch":true,"deployed":false}]}
					"""))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].consumerName").value("selector-consumer"))
			.andExpect(jsonPath("$[0].version").value("2.0.0"))
			.andExpect(jsonPath("$[0].contractName").value("create-order"))
			.andDo(contractDocument("resolve-selectors"));
	}

	@Test
	void should_resolve_selectors_by_environment() throws Exception {
		// given
		given(this.selectorService.resolve(anyList()))
			.willReturn(List.of(new ResolvedContract("env-consumer", "1.0.0", null, "get-order", null)));

		// when/then
		this.mockMvc
			.perform(post("/api/v1/selectors/resolve").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("""
					{"selectors":[{"mainBranch":false,"deployed":true,"environment":"production"}]}
					"""))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].consumerName").value("env-consumer"))
			.andDo(contractDocument("resolve-selectors-by-environment"));
	}

	private static RestDocumentationResultHandler contractDocument(String identifier) {
		return document(identifier, dslContract());
	}

}
