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
package sh.stubborn.oss.verification;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.micrometer.tracing.test.autoconfigure.AutoConfigureTracing;
import org.springframework.boot.restdocs.test.autoconfigure.AutoConfigureRestDocs;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.restdocs.mockmvc.RestDocumentationResultHandler;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import sh.stubborn.oss.audit.AuditService;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.springframework.cloud.contract.wiremock.restdocs.SpringCloudContractRestDocs.dslContract;
import static org.springframework.restdocs.mockmvc.MockMvcRestDocumentation.document;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Tag("generate-stubs")
@WebMvcTest(VerificationController.class)
@AutoConfigureTracing
@AutoConfigureRestDocs
@WithMockUser(roles = "PUBLISHER")
class VerificationContractTest {

	@Autowired
	MockMvc mockMvc;

	@MockitoBean
	VerificationService verificationService;

	@SuppressWarnings("unused")
	@MockitoBean
	AuditService auditService;

	@Test
	void should_record_verification() throws Exception {
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
			.andExpect(jsonPath("$.status").value("SUCCESS"))
			.andDo(contractDocument("record-verification"));
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
			.andDo(contractDocument("list-verifications"));
	}

	private static RestDocumentationResultHandler contractDocument(String identifier) {
		return document(identifier, dslContract());
	}

}
