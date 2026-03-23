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
package sh.stubborn.broker.safety;

import java.util.List;

import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.micrometer.tracing.test.autoconfigure.AutoConfigureTracing;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import sh.stubborn.broker.application.ApplicationNotFoundException;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(CanIDeployController.class)
@AutoConfigureTracing
@WithMockUser(roles = "ADMIN")
class CanIDeployControllerTest {

	@Autowired
	MockMvc mockMvc;

	@MockitoBean
	CanIDeployService canIDeployService;

	@Test
	void should_return_safe_result() throws Exception {
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
			.andExpect(jsonPath("$.application").value("order-service"))
			.andExpect(jsonPath("$.consumerResults[0].consumer").value("payment-service"));
	}

	@Test
	void should_return_unsafe_result() throws Exception {
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
			.andExpect(jsonPath("$.safe").value(false));
	}

	@Test
	void should_return_404_when_application_not_found() throws Exception {
		// given
		given(this.canIDeployService.check("unknown", "1.0.0", "staging", null))
			.willThrow(new ApplicationNotFoundException("unknown"));

		// when/then
		this.mockMvc
			.perform(get("/api/v1/can-i-deploy").param("application", "unknown")
				.param("version", "1.0.0")
				.param("environment", "staging"))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("APPLICATION_NOT_FOUND"));
	}

	@Test
	void should_check_with_branch_parameter() throws Exception {
		// given
		var response = new CanIDeployResponse("order-service", "1.0.0", "staging", "feature/payments", true,
				"No consumers deployed to this environment", List.of());
		given(this.canIDeployService.check("order-service", "1.0.0", "staging", "feature/payments"))
			.willReturn(response);

		// when/then
		this.mockMvc
			.perform(get("/api/v1/can-i-deploy").param("application", "order-service")
				.param("version", "1.0.0")
				.param("environment", "staging")
				.param("branch", "feature/payments"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.branch").value("feature/payments"));
	}

	@Test
	void should_return_400_when_missing_params() throws Exception {
		this.mockMvc.perform(get("/api/v1/can-i-deploy")).andExpect(status().isBadRequest());
	}

}
