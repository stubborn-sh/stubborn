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
package sh.stubborn.oss.matrix;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.micrometer.tracing.test.autoconfigure.AutoConfigureTracing;
import org.springframework.boot.restdocs.test.autoconfigure.AutoConfigureRestDocs;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.restdocs.mockmvc.RestDocumentationResultHandler;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import sh.stubborn.oss.audit.AuditService;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.BDDMockito.given;
import static org.springframework.cloud.contract.wiremock.restdocs.SpringCloudContractRestDocs.dslContract;
import static org.springframework.restdocs.mockmvc.MockMvcRestDocumentation.document;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Tag("generate-stubs")
@WebMvcTest(MatrixController.class)
@AutoConfigureTracing
@AutoConfigureRestDocs
@WithMockUser(roles = "READER")
@TestPropertySource(properties = "broker.pro.enabled=true")
class MatrixContractTest {

	@Autowired
	MockMvc mockMvc;

	@MockitoBean
	MatrixService matrixService;

	@SuppressWarnings("unused")
	@MockitoBean
	AuditService auditService;

	@Test
	void should_return_full_matrix() throws Exception {
		// given
		given(this.matrixService.query(null, null)).willReturn(List.of(new MatrixEntry("matrix-provider", "1.0.0",
				"matrix-consumer", "2.0.0", "SUCCESS", "main", Instant.parse("2026-02-01T10:00:00Z"))));

		// when/then
		this.mockMvc.perform(get("/api/v1/matrix"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].providerName").value("matrix-provider"))
			.andExpect(jsonPath("$[0].consumerName").value("matrix-consumer"))
			.andExpect(jsonPath("$[0].status").value("SUCCESS"))
			.andExpect(jsonPath("$[0].branch").value("main"))
			.andDo(contractDocument("query-matrix"));
	}

	@Test
	void should_filter_matrix_by_provider() throws Exception {
		// given
		given(this.matrixService.query("matrix-filter-provider", null))
			.willReturn(List.of(new MatrixEntry("matrix-filter-provider", "1.0.0", "matrix-filter-consumer", "3.0.0",
					"FAILED", "feature/x", Instant.parse("2026-02-02T10:00:00Z"))));

		// when/then
		this.mockMvc.perform(get("/api/v1/matrix").param("provider", "matrix-filter-provider"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].providerName").value("matrix-filter-provider"))
			.andExpect(jsonPath("$[0].status").value("FAILED"))
			.andDo(contractDocument("query-matrix-by-provider"));
	}

	private static RestDocumentationResultHandler contractDocument(String identifier) {
		return document(identifier, dslContract());
	}

}
