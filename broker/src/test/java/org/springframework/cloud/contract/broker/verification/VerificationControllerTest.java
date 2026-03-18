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
package org.springframework.cloud.contract.broker.verification;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.micrometer.tracing.test.autoconfigure.AutoConfigureTracing;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.cloud.contract.broker.application.ApplicationNotFoundException;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(VerificationController.class)
@AutoConfigureTracing
@WithMockUser(roles = "ADMIN")
class VerificationControllerTest {

	@Autowired
	MockMvc mockMvc;

	@MockitoBean
	VerificationService verificationService;

	@Test
	void should_record_verification_and_return_201() throws Exception {
		// given
		UUID providerId = UUID.randomUUID();
		UUID consumerId = UUID.randomUUID();
		Verification verification = Verification.create(providerId, "1.0.0", consumerId, "2.0.0",
				VerificationStatus.SUCCESS, null);
		given(this.verificationService.record("order-service", "1.0.0", "payment-service", "2.0.0", "SUCCESS", null,
				null))
			.willReturn(verification);

		// when/then
		this.mockMvc.perform(post("/api/v1/verifications").contentType(MediaType.APPLICATION_JSON).content("""
				{
				  "providerName": "order-service",
				  "providerVersion": "1.0.0",
				  "consumerName": "payment-service",
				  "consumerVersion": "2.0.0",
				  "status": "SUCCESS"
				}
				"""))
			.andExpect(status().isCreated())
			.andExpect(header().exists("Location"))
			.andExpect(jsonPath("$.providerVersion").value("1.0.0"))
			.andExpect(jsonPath("$.consumerVersion").value("2.0.0"))
			.andExpect(jsonPath("$.status").value("SUCCESS"));
	}

	@Test
	void should_return_404_when_provider_not_found() throws Exception {
		// given
		given(this.verificationService.record("unknown", "1.0.0", "consumer", "1.0.0", "SUCCESS", null, null))
			.willThrow(new ApplicationNotFoundException("unknown"));

		// when/then
		this.mockMvc.perform(post("/api/v1/verifications").contentType(MediaType.APPLICATION_JSON).content("""
				{
				  "providerName": "unknown",
				  "providerVersion": "1.0.0",
				  "consumerName": "consumer",
				  "consumerVersion": "1.0.0",
				  "status": "SUCCESS"
				}
				""")).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("APPLICATION_NOT_FOUND"));
	}

	@Test
	void should_return_409_when_duplicate_verification() throws Exception {
		// given
		given(this.verificationService.record("order-service", "1.0.0", "payment-service", "2.0.0", "SUCCESS", null,
				null))
			.willThrow(new VerificationAlreadyExistsException("order-service", "1.0.0", "payment-service", "2.0.0"));

		// when/then
		this.mockMvc.perform(post("/api/v1/verifications").contentType(MediaType.APPLICATION_JSON).content("""
				{
				  "providerName": "order-service",
				  "providerVersion": "1.0.0",
				  "consumerName": "payment-service",
				  "consumerVersion": "2.0.0",
				  "status": "SUCCESS"
				}
				"""))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("VERIFICATION_ALREADY_EXISTS"));
	}

	@Test
	void should_record_verification_with_branch() throws Exception {
		// given
		UUID providerId = UUID.randomUUID();
		UUID consumerId = UUID.randomUUID();
		Verification verification = Verification.create(providerId, "1.0.0", consumerId, "2.0.0",
				VerificationStatus.SUCCESS, null, "feature/payments");
		given(this.verificationService.record("order-service", "1.0.0", "payment-service", "2.0.0", "SUCCESS", null,
				"feature/payments"))
			.willReturn(verification);

		// when/then
		this.mockMvc.perform(post("/api/v1/verifications").contentType(MediaType.APPLICATION_JSON).content("""
				{
				  "providerName": "order-service",
				  "providerVersion": "1.0.0",
				  "consumerName": "payment-service",
				  "consumerVersion": "2.0.0",
				  "status": "SUCCESS",
				  "branch": "feature/payments"
				}
				""")).andExpect(status().isCreated()).andExpect(jsonPath("$.branch").value("feature/payments"));
	}

	@Test
	void should_return_400_when_status_invalid() throws Exception {
		this.mockMvc.perform(post("/api/v1/verifications").contentType(MediaType.APPLICATION_JSON).content("""
				{
				  "providerName": "order-service",
				  "providerVersion": "1.0.0",
				  "consumerName": "payment-service",
				  "consumerVersion": "2.0.0",
				  "status": "INVALID"
				}
				""")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
	}

	@Test
	void should_list_verifications_by_provider() throws Exception {
		// given
		UUID providerId = UUID.randomUUID();
		UUID consumerId = UUID.randomUUID();
		Verification v = Verification.create(providerId, "1.0.0", consumerId, "2.0.0", VerificationStatus.SUCCESS,
				null);
		given(this.verificationService.findByProviderAndVersion(eq("order-service"), eq("1.0.0"), any(Pageable.class)))
			.willReturn(new PageImpl<>(List.of(v)));
		given(this.verificationService.resolveApplicationName(providerId)).willReturn("order-service");
		given(this.verificationService.resolveApplicationName(consumerId)).willReturn("payment-service");

		// when/then
		this.mockMvc.perform(get("/api/v1/verifications?provider=order-service&providerVersion=1.0.0"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.content", hasSize(1)))
			.andExpect(jsonPath("$.content[0].status").value("SUCCESS"))
			.andExpect(jsonPath("$.content[0].providerName").value("order-service"))
			.andExpect(jsonPath("$.content[0].consumerName").value("payment-service"));
	}

	@Test
	void should_list_all_verifications_when_no_params() throws Exception {
		// given
		UUID providerId = UUID.randomUUID();
		UUID consumerId = UUID.randomUUID();
		Verification v = Verification.create(providerId, "1.0.0", consumerId, "2.0.0", VerificationStatus.SUCCESS,
				null);
		given(this.verificationService.findAll(any(), any(Pageable.class))).willReturn(new PageImpl<>(List.of(v)));
		given(this.verificationService.resolveApplicationName(providerId)).willReturn("order-service");
		given(this.verificationService.resolveApplicationName(consumerId)).willReturn("payment-service");

		// when/then
		this.mockMvc.perform(get("/api/v1/verifications"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.content", hasSize(1)))
			.andExpect(jsonPath("$.content[0].providerName").value("order-service"));
	}

	@Test
	void should_search_verifications_by_term() throws Exception {
		// given
		UUID providerId = UUID.randomUUID();
		UUID consumerId = UUID.randomUUID();
		Verification v = Verification.create(providerId, "1.0.0", consumerId, "2.0.0", VerificationStatus.SUCCESS,
				null);
		given(this.verificationService.findAll(eq("order"), any(Pageable.class)))
			.willReturn(new PageImpl<>(List.of(v)));
		given(this.verificationService.resolveApplicationName(providerId)).willReturn("order-service");
		given(this.verificationService.resolveApplicationName(consumerId)).willReturn("payment-service");

		// when/then
		this.mockMvc.perform(get("/api/v1/verifications?search=order"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.content", hasSize(1)))
			.andExpect(jsonPath("$.content[0].providerName").value("order-service"));
	}

	@Test
	void should_get_verification_by_id() throws Exception {
		// given
		UUID providerId = UUID.randomUUID();
		UUID consumerId = UUID.randomUUID();
		Verification v = Verification.create(providerId, "1.0.0", consumerId, "2.0.0", VerificationStatus.FAILED,
				"Test failed");
		UUID verificationId = UUID.randomUUID();
		given(this.verificationService.findById(verificationId)).willReturn(v);
		given(this.verificationService.resolveApplicationName(providerId)).willReturn("order-service");
		given(this.verificationService.resolveApplicationName(consumerId)).willReturn("payment-service");

		// when/then
		this.mockMvc.perform(get("/api/v1/verifications/" + verificationId))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("FAILED"))
			.andExpect(jsonPath("$.details").value("Test failed"));
	}

	@Test
	void should_return_404_when_verification_not_found() throws Exception {
		// given
		UUID verificationId = UUID.randomUUID();
		given(this.verificationService.findById(verificationId))
			.willThrow(new VerificationNotFoundException(verificationId));

		// when/then
		this.mockMvc.perform(get("/api/v1/verifications/" + verificationId))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("VERIFICATION_NOT_FOUND"));
	}

	@Test
	void should_fall_back_to_find_all_when_only_provider_without_version() throws Exception {
		// given
		UUID providerId = UUID.randomUUID();
		UUID consumerId = UUID.randomUUID();
		Verification v = Verification.create(providerId, "1.0.0", consumerId, "2.0.0", VerificationStatus.SUCCESS,
				null);
		given(this.verificationService.findAll(any(), any(Pageable.class))).willReturn(new PageImpl<>(List.of(v)));
		given(this.verificationService.resolveApplicationName(providerId)).willReturn("order-service");
		given(this.verificationService.resolveApplicationName(consumerId)).willReturn("payment-service");

		// when/then
		this.mockMvc.perform(get("/api/v1/verifications?provider=order-service"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.content", hasSize(1)))
			.andExpect(jsonPath("$.content[0].providerName").value("order-service"));
	}

	@Test
	void should_fall_back_to_find_all_when_only_provider_version_without_provider() throws Exception {
		// given
		UUID providerId = UUID.randomUUID();
		UUID consumerId = UUID.randomUUID();
		Verification v = Verification.create(providerId, "1.0.0", consumerId, "2.0.0", VerificationStatus.SUCCESS,
				null);
		given(this.verificationService.findAll(any(), any(Pageable.class))).willReturn(new PageImpl<>(List.of(v)));
		given(this.verificationService.resolveApplicationName(providerId)).willReturn("order-service");
		given(this.verificationService.resolveApplicationName(consumerId)).willReturn("payment-service");

		// when/then
		this.mockMvc.perform(get("/api/v1/verifications?providerVersion=1.0.0"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.content", hasSize(1)))
			.andExpect(jsonPath("$.content[0].providerName").value("order-service"));
	}

}
