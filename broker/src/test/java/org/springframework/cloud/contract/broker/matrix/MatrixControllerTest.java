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
package org.springframework.cloud.contract.broker.matrix;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.micrometer.tracing.test.autoconfigure.AutoConfigureTracing;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(MatrixController.class)
@AutoConfigureTracing
@TestPropertySource(properties = "broker.pro.enabled=true")
class MatrixControllerTest {

	@Autowired
	MockMvc mockMvc;

	@MockitoBean
	MatrixService matrixService;

	@Test
	@WithMockUser(roles = "READER")
	void should_return_matrix_entries() throws Exception {
		// given
		MatrixEntry entry = new MatrixEntry("order-service", "1.0.0", "payment-service", "2.0.0", "SUCCESS", "main",
				Instant.parse("2026-01-15T10:00:00Z"));
		given(this.matrixService.query(null, null)).willReturn(List.of(entry));

		// when/then
		this.mockMvc.perform(get("/api/v1/matrix"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].providerName").value("order-service"))
			.andExpect(jsonPath("$[0].consumerName").value("payment-service"))
			.andExpect(jsonPath("$[0].status").value("SUCCESS"));
	}

	@Test
	@WithMockUser(roles = "READER")
	void should_filter_by_provider() throws Exception {
		// given
		given(this.matrixService.query("order-service", null)).willReturn(List.of());

		// when/then
		this.mockMvc.perform(get("/api/v1/matrix").param("provider", "order-service"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$").isArray());
	}

	@Test
	@WithMockUser(roles = "READER")
	void should_return_empty_matrix() throws Exception {
		// given
		given(this.matrixService.query(null, null)).willReturn(List.of());

		// when/then
		this.mockMvc.perform(get("/api/v1/matrix")).andExpect(status().isOk()).andExpect(jsonPath("$").isEmpty());
	}

}
