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
import sh.stubborn.oss.audit.AuditService;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.BDDMockito.given;
import static org.springframework.cloud.contract.wiremock.restdocs.SpringCloudContractRestDocs.dslContract;
import static org.springframework.restdocs.mockmvc.MockMvcRestDocumentation.document;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Tag("generate-stubs")
@WebMvcTest(CleanupController.class)
@AutoConfigureTracing
@AutoConfigureRestDocs
@WithMockUser(roles = "ADMIN")
@TestPropertySource(properties = "broker.pro.enabled=true")
class CleanupContractTest {

	@Autowired
	MockMvc mockMvc;

	@MockitoBean
	CleanupService cleanupService;

	@SuppressWarnings("unused")
	@MockitoBean
	AuditService auditService;

	@Test
	void should_cleanup_all_applications() throws Exception {
		// given
		given(this.cleanupService.cleanup(null, 5, List.of("production", "staging")))
			.willReturn(new CleanupResult(3, List.of("cleanup-app:0.1.0:contract-a", "cleanup-app:0.2.0:contract-b",
					"cleanup-app:0.3.0:contract-c")));

		// when/then
		this.mockMvc.perform(post("/api/v1/maintenance/cleanup").contentType(MediaType.APPLICATION_JSON).content("""
				{"keepLatestVersions":5,"protectedEnvironments":["production","staging"]}
				"""))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.deletedCount").value(3))
			.andExpect(jsonPath("$.deletedContracts[0]").value("cleanup-app:0.1.0:contract-a"))
			.andDo(contractDocument("cleanup-all"));
	}

	@Test
	void should_cleanup_single_application() throws Exception {
		// given
		given(this.cleanupService.cleanup("cleanup-single-app", 3, List.of("production")))
			.willReturn(new CleanupResult(1, List.of("cleanup-single-app:0.1.0:old-contract")));

		// when/then
		this.mockMvc.perform(post("/api/v1/maintenance/cleanup").contentType(MediaType.APPLICATION_JSON).content("""
				{"applicationName":"cleanup-single-app","keepLatestVersions":3,"protectedEnvironments":["production"]}
				"""))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.deletedCount").value(1))
			.andDo(contractDocument("cleanup-single-app"));
	}

	private static RestDocumentationResultHandler contractDocument(String identifier) {
		return document(identifier, dslContract());
	}

}
