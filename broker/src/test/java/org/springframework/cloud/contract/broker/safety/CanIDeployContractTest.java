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
package org.springframework.cloud.contract.broker.safety;

import java.util.List;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.micrometer.tracing.test.autoconfigure.AutoConfigureTracing;
import org.springframework.boot.restdocs.test.autoconfigure.AutoConfigureRestDocs;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.restdocs.mockmvc.RestDocumentationResultHandler;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.BDDMockito.given;
import static org.springframework.cloud.contract.wiremock.restdocs.SpringCloudContractRestDocs.dslContract;
import static org.springframework.restdocs.mockmvc.MockMvcRestDocumentation.document;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Tag("generate-stubs")
@WebMvcTest(CanIDeployController.class)
@AutoConfigureTracing
@AutoConfigureRestDocs
@WithMockUser(roles = "READER")
class CanIDeployContractTest {

	@Autowired
	MockMvc mockMvc;

	@MockitoBean
	CanIDeployService canIDeployService;

	@Test
	void should_check_deployment_safety() throws Exception {
		// given
		var response = new CanIDeployResponse("order-service", "1.0.0", "staging", null, true,
				"All 1 consumer(s) verified successfully",
				List.of(new ConsumerResult("payment-service", "2.0.0", true)));
		given(this.canIDeployService.check("order-service", "1.0.0", "staging", null)).willReturn(response);

		// when/then
		this.mockMvc
			.perform(get("/api/v1/can-i-deploy").param("application", "order-service")
				.param("version", "1.0.0")
				.param("environment", "staging"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.safe").value(true))
			.andExpect(jsonPath("$.consumerResults[0].consumer").value("payment-service"))
			.andDo(contractDocument("can-i-deploy-safe"));
	}

	@Test
	void should_check_deployment_unsafe() throws Exception {
		// given
		var response = new CanIDeployResponse("order-service", "1.0.0", "staging", null, false,
				"1 of 1 consumer(s) missing successful verification",
				List.of(new ConsumerResult("payment-service", "2.0.0", false)));
		given(this.canIDeployService.check("order-service", "1.0.0", "staging", null)).willReturn(response);

		// when/then
		this.mockMvc
			.perform(get("/api/v1/can-i-deploy").param("application", "order-service")
				.param("version", "1.0.0")
				.param("environment", "staging"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.safe").value(false))
			.andDo(contractDocument("can-i-deploy-unsafe"));
	}

	private static RestDocumentationResultHandler contractDocument(String identifier) {
		return document(identifier, dslContract());
	}

}
