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
package sh.stubborn.oss.contract;

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
@WebMvcTest(ContractController.class)
@AutoConfigureTracing
@AutoConfigureRestDocs
@WithMockUser(roles = "PUBLISHER")
class ContractContractTest {

	@Autowired
	MockMvc mockMvc;

	@MockitoBean
	ContractService contractService;

	@SuppressWarnings("unused")
	@MockitoBean
	AuditService auditService;

	@Test
	void should_publish_contract() throws Exception {
		// given
		Contract contract = Contract.create(UUID.randomUUID(), "1.0.0", "create-order", "request: {}",
				"application/x-spring-cloud-contract+yaml");
		given(this.contractService.publish("order-service", "1.0.0", "create-order", "request: {}",
				"application/x-spring-cloud-contract+yaml", null))
			.willReturn(contract);

		// when/then
		this.mockMvc
			.perform(post("/api/v1/applications/order-service/versions/1.0.0/contracts")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{
						  "contractName": "create-order",
						  "content": "request: {}",
						  "contentType": "application/x-spring-cloud-contract+yaml"
						}
						"""))
			.andExpect(status().isCreated())
			.andExpect(header().string("Location",
					"/api/v1/applications/order-service/versions/1.0.0/contracts/create-order"))
			.andDo(contractDocument("publish-contract"));
	}

	@Test
	void should_return_409_when_contract_already_exists() throws Exception {
		// given
		given(this.contractService.publish("existing-service", "1.0.0", "existing-contract", "request: {}",
				"application/x-spring-cloud-contract+yaml", null))
			.willThrow(new ContractAlreadyExistsException("existing-service", "1.0.0", "existing-contract"));

		// when/then
		this.mockMvc
			.perform(post("/api/v1/applications/existing-service/versions/1.0.0/contracts")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{
						  "contractName": "existing-contract",
						  "content": "request: {}",
						  "contentType": "application/x-spring-cloud-contract+yaml"
						}
						"""))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("CONTRACT_ALREADY_EXISTS"))
			.andDo(contractDocument("publish-contract-conflict"));
	}

	@Test
	void should_list_contracts_for_version() throws Exception {
		// given
		Contract c1 = Contract.create(UUID.randomUUID(), "1.0.0", "create-order", "request: {}", "yaml");
		Contract c2 = Contract.create(UUID.randomUUID(), "1.0.0", "get-order", "response: {}", "yaml");
		given(this.contractService.findByApplicationAndVersion(eq("order-service"), eq("1.0.0"), any(Pageable.class)))
			.willReturn(new PageImpl<>(List.of(c1, c2)));

		// when/then
		this.mockMvc.perform(get("/api/v1/applications/order-service/versions/1.0.0/contracts"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.content", hasSize(2)))
			.andDo(contractDocument("list-contracts"));
	}

	@Test
	void should_get_contract_by_name() throws Exception {
		// given
		Contract contract = Contract.create(UUID.randomUUID(), "1.0.0", "create-order", "request: {}", "yaml");
		given(this.contractService.findByApplicationAndVersionAndName("order-service", "1.0.0", "create-order"))
			.willReturn(contract);

		// when/then
		this.mockMvc.perform(get("/api/v1/applications/order-service/versions/1.0.0/contracts/create-order"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.contractName").value("create-order"))
			.andDo(contractDocument("get-contract"));
	}

	private static RestDocumentationResultHandler contractDocument(String identifier) {
		return document(identifier, dslContract());
	}

}
