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
package sh.stubborn.broker.contract;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.micrometer.tracing.test.autoconfigure.AutoConfigureTracing;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import sh.stubborn.broker.application.ApplicationNotFoundException;
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
import static org.mockito.BDDMockito.willDoNothing;
import static org.mockito.BDDMockito.willThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ContractController.class)
@AutoConfigureTracing
@WithMockUser(roles = "ADMIN")
class ContractControllerTest {

	@Autowired
	MockMvc mockMvc;

	@MockitoBean
	ContractService contractService;

	@Test
	void should_publish_contract_and_return_201() throws Exception {
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
			.andExpect(jsonPath("$.contractName").value("create-order"))
			.andExpect(jsonPath("$.version").value("1.0.0"))
			.andExpect(jsonPath("$.content").value("request: {}"));
	}

	@Test
	void should_return_404_when_application_not_found() throws Exception {
		// given
		given(this.contractService.publish("unknown", "1.0.0", "test", "content", "application/json", null))
			.willThrow(new ApplicationNotFoundException("unknown"));

		// when/then
		this.mockMvc
			.perform(post("/api/v1/applications/unknown/versions/1.0.0/contracts")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"contractName": "test", "content": "content", "contentType": "application/json"}
						"""))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("APPLICATION_NOT_FOUND"));
	}

	@Test
	void should_return_409_when_contract_already_exists() throws Exception {
		// given
		given(this.contractService.publish("order-service", "1.0.0", "create-order", "content", "application/json",
				null))
			.willThrow(new ContractAlreadyExistsException("order-service", "1.0.0", "create-order"));

		// when/then
		this.mockMvc
			.perform(post("/api/v1/applications/order-service/versions/1.0.0/contracts")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"contractName": "create-order", "content": "content", "contentType": "application/json"}
						"""))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("CONTRACT_ALREADY_EXISTS"));
	}

	@Test
	void should_publish_contract_with_branch() throws Exception {
		// given
		Contract contract = Contract.create(UUID.randomUUID(), "1.0.0", "create-order", "request: {}",
				"application/x-spring-cloud-contract+yaml", "feature/payments", null);
		given(this.contractService.publish("order-service", "1.0.0", "create-order", "request: {}",
				"application/x-spring-cloud-contract+yaml", "feature/payments"))
			.willReturn(contract);

		// when/then
		this.mockMvc
			.perform(post("/api/v1/applications/order-service/versions/1.0.0/contracts")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{
						  "contractName": "create-order",
						  "content": "request: {}",
						  "contentType": "application/x-spring-cloud-contract+yaml",
						  "branch": "feature/payments"
						}
						"""))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.branch").value("feature/payments"));
	}

	@Test
	void should_return_400_when_contract_name_is_missing() throws Exception {
		this.mockMvc
			.perform(post("/api/v1/applications/order-service/versions/1.0.0/contracts")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"content": "content", "contentType": "application/json"}
						"""))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
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
			.andExpect(jsonPath("$.content[0].contractName").value("create-order"))
			.andExpect(jsonPath("$.content[1].contractName").value("get-order"));
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
			.andExpect(jsonPath("$.content").value("request: {}"));
	}

	@Test
	void should_return_404_when_contract_not_found() throws Exception {
		// given
		given(this.contractService.findByApplicationAndVersionAndName("order-service", "1.0.0", "missing"))
			.willThrow(new ContractNotFoundException("order-service", "1.0.0", "missing"));

		// when/then
		this.mockMvc.perform(get("/api/v1/applications/order-service/versions/1.0.0/contracts/missing"))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("CONTRACT_NOT_FOUND"));
	}

	@Test
	void should_delete_contract_and_return_204() throws Exception {
		// given
		willDoNothing().given(this.contractService).delete("order-service", "1.0.0", "create-order");

		// when/then
		this.mockMvc.perform(delete("/api/v1/applications/order-service/versions/1.0.0/contracts/create-order"))
			.andExpect(status().isNoContent());
	}

	@Test
	void should_return_404_when_deleting_nonexistent_contract() throws Exception {
		// given
		willThrow(new ContractNotFoundException("order-service", "1.0.0", "missing")).given(this.contractService)
			.delete("order-service", "1.0.0", "missing");

		// when/then
		this.mockMvc.perform(delete("/api/v1/applications/order-service/versions/1.0.0/contracts/missing"))
			.andExpect(status().isNotFound());
	}

}
