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
package sh.stubborn.oss.audit;

import java.util.List;

import io.github.resilience4j.ratelimiter.RateLimiterRegistry;
import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.micrometer.tracing.test.autoconfigure.AutoConfigureTracing;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AuditController.class)
@AutoConfigureTracing
@WithMockUser(roles = "ADMIN")
class AuditControllerTest {

	@Autowired
	MockMvc mockMvc;

	@MockitoBean
	AuditService auditService;

	@MockitoBean
	RateLimiterRegistry rateLimiterRegistry;

	@Test
	void should_return_paginated_audit_entries() throws Exception {
		// given
		ApiAuditLog entry = ApiAuditLog.create("admin", AuditAction.CREATE, AuditResourceType.APPLICATION,
				"order-service", "POST /api/v1/applications", 201, "127.0.0.1", "trace-abc");
		PageImpl<ApiAuditLog> page = new PageImpl<>(List.of(entry), PageRequest.of(0, 10), 1);
		given(this.auditService.findFiltered(isNull(), isNull(), isNull(), any())).willReturn(page);

		// when/then
		this.mockMvc.perform(get("/api/v1/audit"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.content", hasSize(1)))
			.andExpect(jsonPath("$.content[0].principal").value("admin"))
			.andExpect(jsonPath("$.content[0].action").value("CREATE"))
			.andExpect(jsonPath("$.content[0].resourceType").value("APPLICATION"))
			.andExpect(jsonPath("$.content[0].resourceId").value("order-service"))
			.andExpect(jsonPath("$.content[0].responseStatus").value(201))
			.andExpect(jsonPath("$.content[0].traceId").value("trace-abc"));
	}

	@Test
	void should_filter_by_principal() throws Exception {
		// given
		ApiAuditLog entry = ApiAuditLog.create("publisher", AuditAction.DELETE, AuditResourceType.CONTRACT, "c-1",
				"DELETE /api/v1/contracts/c-1", 204, "10.0.0.1", null);
		PageImpl<ApiAuditLog> page = new PageImpl<>(List.of(entry), PageRequest.of(0, 10), 1);
		given(this.auditService.findFiltered(eq("publisher"), isNull(), isNull(), any())).willReturn(page);

		// when/then
		this.mockMvc.perform(get("/api/v1/audit?principal=publisher"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.content", hasSize(1)))
			.andExpect(jsonPath("$.content[0].principal").value("publisher"));
	}

	@Test
	void should_filter_by_action_and_resource_type() throws Exception {
		// given
		ApiAuditLog entry = ApiAuditLog.create("admin", AuditAction.IMPORT, AuditResourceType.MAVEN_SOURCE, "ms-1",
				"POST /api/v1/maven/import", 200, "10.0.0.1", null);
		PageImpl<ApiAuditLog> page = new PageImpl<>(List.of(entry), PageRequest.of(0, 10), 1);
		given(this.auditService.findFiltered(isNull(), eq(AuditAction.IMPORT), eq(AuditResourceType.MAVEN_SOURCE),
				any()))
			.willReturn(page);

		// when/then
		this.mockMvc.perform(get("/api/v1/audit?action=IMPORT&resourceType=MAVEN_SOURCE"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.content", hasSize(1)))
			.andExpect(jsonPath("$.content[0].action").value("IMPORT"))
			.andExpect(jsonPath("$.content[0].resourceType").value("MAVEN_SOURCE"));
	}

	@Test
	void should_return_empty_page_when_no_entries() throws Exception {
		// given
		PageImpl<ApiAuditLog> page = new PageImpl<>(List.of(), PageRequest.of(0, 10), 0);
		given(this.auditService.findFiltered(isNull(), isNull(), isNull(), any())).willReturn(page);

		// when/then
		this.mockMvc.perform(get("/api/v1/audit"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.content", hasSize(0)))
			.andExpect(jsonPath("$.totalElements").value(0));
	}

}
