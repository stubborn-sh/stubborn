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
package sh.stubborn.oss.selector;

import java.util.List;

import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.micrometer.tracing.test.autoconfigure.AutoConfigureTracing;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import sh.stubborn.oss.audit.AuditService;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(SelectorController.class)
@AutoConfigureTracing
@TestPropertySource(properties = "broker.pro.enabled=true")
class SelectorControllerTest {

	@Autowired
	MockMvc mockMvc;

	@MockitoBean
	SelectorService selectorService;

	@SuppressWarnings("unused")
	@MockitoBean
	AuditService auditService;

	@Test
	@WithMockUser(roles = "PUBLISHER")
	void should_resolve_selectors() throws Exception {
		// given
		given(this.selectorService.resolve(anyList()))
			.willReturn(List.of(new ResolvedContract("order-service", "1.0.0", "main", "get-orders", "abc123")));

		// when/then
		this.mockMvc.perform(post("/api/v1/selectors/resolve").contentType(MediaType.APPLICATION_JSON).content("""
				{"selectors": [{"mainBranch": true, "deployed": false}]}
				"""))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].consumerName").value("order-service"))
			.andExpect(jsonPath("$[0].version").value("1.0.0"))
			.andExpect(jsonPath("$[0].contractName").value("get-orders"));
	}

	@Test
	@WithMockUser(roles = "PUBLISHER")
	void should_return_400_when_selectors_empty() throws Exception {
		// when/then
		this.mockMvc.perform(post("/api/v1/selectors/resolve").contentType(MediaType.APPLICATION_JSON).content("""
				{"selectors": []}
				""")).andExpect(status().isBadRequest());
	}

	@Test
	@WithMockUser(roles = "PUBLISHER")
	void should_deserialize_selector_with_omitted_boolean_fields() throws Exception {
		// given — JSON omits "deployed" field (the exact bug scenario)
		given(this.selectorService.resolve(anyList()))
			.willReturn(List.of(new ResolvedContract("order-service", "1.0.0", "main", "get-orders", "abc123")));

		// when/then — must not fail with FAIL_ON_NULL_FOR_PRIMITIVES
		this.mockMvc.perform(post("/api/v1/selectors/resolve").contentType(MediaType.APPLICATION_JSON).content("""
				{"selectors": [{"mainBranch": true}]}
				""")).andExpect(status().isOk()).andExpect(jsonPath("$[0].consumerName").value("order-service"));
	}

	@Test
	@WithMockUser(roles = "READER")
	void should_return_empty_list_when_no_matches() throws Exception {
		// given
		given(this.selectorService.resolve(anyList())).willReturn(List.of());

		// when/then
		this.mockMvc.perform(post("/api/v1/selectors/resolve").contentType(MediaType.APPLICATION_JSON).content("""
				{"selectors": [{"mainBranch": false, "consumer": "unknown", "deployed": false}]}
				""")).andExpect(status().isOk()).andExpect(jsonPath("$").isEmpty());
	}

}
