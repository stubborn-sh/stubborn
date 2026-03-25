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
package sh.stubborn.broker.application;

import java.util.List;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import sh.stubborn.broker.contract.ContractService;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.micrometer.tracing.test.autoconfigure.AutoConfigureTracing;
import org.springframework.boot.restdocs.test.autoconfigure.AutoConfigureRestDocs;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.MediaType;
import org.springframework.restdocs.mockmvc.RestDocumentationResultHandler;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willDoNothing;
import static org.springframework.cloud.contract.wiremock.restdocs.SpringCloudContractRestDocs.dslContract;
import static org.springframework.restdocs.mockmvc.MockMvcRestDocumentation.document;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Tag("generate-stubs")
@WebMvcTest(ApplicationController.class)
@AutoConfigureTracing
@AutoConfigureRestDocs
@WithMockUser(roles = "ADMIN")
class ApplicationContractTest {

	@Autowired
	MockMvc mockMvc;

	@MockitoBean
	ApplicationService applicationService;

	@MockitoBean
	ContractService contractService;

	// tag::register-application[]
	@Test
	void should_register_application() throws Exception {
		// given
		Application app = Application.create("order-service", "Manages orders", "team-commerce");
		given(this.applicationService.register("order-service", "Manages orders", "team-commerce", null, null))
			.willReturn(app);

		// when/then
		this.mockMvc.perform(post("/api/v1/applications").contentType(MediaType.APPLICATION_JSON).content("""
				{"name": "order-service", "description": "Manages orders", "owner": "team-commerce"}
				"""))
			.andExpect(status().isCreated())
			.andExpect(header().string("Location", "/api/v1/applications/order-service"))
			.andExpect(jsonPath("$.name").value("order-service"))
			.andDo(contractDocument("register-application"));
	}
	// end::register-application[]

	// tag::get-application[]
	@Test
	void should_get_application_by_name() throws Exception {
		// given
		Application app = Application.create("order-service", "Manages orders", "team-commerce");
		given(this.applicationService.findByName("order-service")).willReturn(app);

		// when/then
		this.mockMvc.perform(get("/api/v1/applications/order-service"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.name").value("order-service"))
			.andDo(contractDocument("get-application"));
	}
	// end::get-application[]

	@Test
	void should_list_applications() throws Exception {
		// given
		Application app = Application.create("order-service", "Manages orders", "team-commerce");
		PageImpl<Application> page = new PageImpl<>(List.of(app), PageRequest.of(0, 20, Sort.by("name")), 1);
		given(this.applicationService.findAll(any(), any())).willReturn(page);

		// when/then
		this.mockMvc.perform(get("/api/v1/applications?page=0&size=20&sort=name,asc"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.content[0].name").value("order-service"))
			.andDo(contractDocument("list-applications"));
	}

	@Test
	void should_return_409_when_application_already_exists() throws Exception {
		// given
		given(this.applicationService.register("existing-service", "Manages orders", "team-commerce", null, null))
			.willThrow(new ApplicationAlreadyExistsException("existing-service"));

		// when/then
		this.mockMvc.perform(post("/api/v1/applications").contentType(MediaType.APPLICATION_JSON).content("""
				{"name": "existing-service", "description": "Manages orders", "owner": "team-commerce"}
				"""))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("APPLICATION_ALREADY_EXISTS"))
			.andDo(contractDocument("register-application-conflict"));
	}

	@Test
	void should_delete_application() throws Exception {
		// given
		willDoNothing().given(this.applicationService).deleteByName("order-service");

		// when/then
		this.mockMvc.perform(delete("/api/v1/applications/order-service"))
			.andExpect(status().isNoContent())
			.andDo(contractDocument("delete-application"));
	}

	private static RestDocumentationResultHandler contractDocument(String identifier) {
		return document(identifier, dslContract());
	}

}
