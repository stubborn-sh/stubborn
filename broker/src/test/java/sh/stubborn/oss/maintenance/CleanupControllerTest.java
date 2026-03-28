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
package sh.stubborn.oss.maintenance;

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

import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(CleanupController.class)
@AutoConfigureTracing
@TestPropertySource(properties = "broker.pro.enabled=true")
class CleanupControllerTest {

	@Autowired
	MockMvc mockMvc;

	@MockitoBean
	CleanupService cleanupService;

	@SuppressWarnings("unused")
	@MockitoBean
	AuditService auditService;

	@Test
	@WithMockUser(roles = "ADMIN")
	void should_run_cleanup() throws Exception {
		// given
		given(this.cleanupService.cleanup(isNull(), anyInt(), anyList())).willReturn(
				new CleanupResult(3, List.of("app:1.0.0:contract1", "app:1.0.0:contract2", "app:1.1.0:contract1")));

		// when/then
		this.mockMvc.perform(post("/api/v1/maintenance/cleanup").contentType(MediaType.APPLICATION_JSON).content("""
				{"keepLatestVersions": 5, "protectedEnvironments": ["prod"]}
				"""))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.deletedCount").value(3))
			.andExpect(jsonPath("$.deletedContracts").isArray());
	}

	@Test
	@WithMockUser(roles = "ADMIN")
	void should_return_400_when_keepLatestVersions_omitted() throws Exception {
		// when/then — JSON omits "keepLatestVersions"; must give 400, not 500
		// FAIL_ON_NULL_FOR_PRIMITIVES crash
		this.mockMvc.perform(post("/api/v1/maintenance/cleanup").contentType(MediaType.APPLICATION_JSON).content("""
				{"protectedEnvironments": ["prod"]}
				""")).andExpect(status().isBadRequest());
	}

	@Test
	@WithMockUser(roles = "ADMIN")
	void should_run_cleanup_for_specific_app() throws Exception {
		// given
		given(this.cleanupService.cleanup("order-service", 2, List.of()))
			.willReturn(new CleanupResult(1, List.of("order-service:1.0.0:get-orders")));

		// when/then
		this.mockMvc.perform(post("/api/v1/maintenance/cleanup").contentType(MediaType.APPLICATION_JSON).content("""
				{"applicationName": "order-service", "keepLatestVersions": 2, "protectedEnvironments": []}
				""")).andExpect(status().isOk()).andExpect(jsonPath("$.deletedCount").value(1));
	}

}
