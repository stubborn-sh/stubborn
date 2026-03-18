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
package org.springframework.cloud.contract.broker.application;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.micrometer.tracing.test.autoconfigure.AutoConfigureTracing;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.cloud.contract.broker.contract.ContractService;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willDoNothing;
import static org.mockito.BDDMockito.willThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ApplicationController.class)
@AutoConfigureTracing
@WithMockUser(roles = "ADMIN")
class ApplicationControllerTest {

	@Autowired
	MockMvc mockMvc;

	@MockitoBean
	ApplicationService applicationService;

	@MockitoBean
	ContractService contractService;

	@Test
	void should_register_application_and_return_201() throws Exception {
		// given
		Application app = Application.create("order-service", "Manages orders", "team-commerce");
		given(this.applicationService.register("order-service", "Manages orders", "team-commerce", null))
			.willReturn(app);

		// when/then
		this.mockMvc.perform(post("/api/v1/applications").contentType(MediaType.APPLICATION_JSON).content("""
				{"name": "order-service", "description": "Manages orders", "owner": "team-commerce"}
				"""))
			.andExpect(status().isCreated())
			.andExpect(header().string("Location", "/api/v1/applications/order-service"))
			.andExpect(jsonPath("$.name").value("order-service"))
			.andExpect(jsonPath("$.description").value("Manages orders"))
			.andExpect(jsonPath("$.owner").value("team-commerce"))
			.andExpect(jsonPath("$.createdAt").exists());
	}

	@Test
	void should_return_409_when_name_already_exists() throws Exception {
		// given
		given(this.applicationService.register("order-service", "desc", "owner", null))
			.willThrow(new ApplicationAlreadyExistsException("order-service"));

		// when/then
		this.mockMvc.perform(post("/api/v1/applications").contentType(MediaType.APPLICATION_JSON).content("""
				{"name": "order-service", "description": "desc", "owner": "owner"}
				"""))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("APPLICATION_ALREADY_EXISTS"));
	}

	@Test
	void should_return_400_when_name_is_missing() throws Exception {
		this.mockMvc.perform(post("/api/v1/applications").contentType(MediaType.APPLICATION_JSON).content("""
				{"description": "desc", "owner": "owner"}
				""")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
	}

	@Test
	void should_return_400_when_owner_is_missing() throws Exception {
		this.mockMvc.perform(post("/api/v1/applications").contentType(MediaType.APPLICATION_JSON).content("""
				{"name": "order-service", "description": "desc"}
				""")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
	}

	@Test
	void should_get_application_by_name() throws Exception {
		// given
		Application app = Application.create("order-service", "Manages orders", "team-commerce");
		given(this.applicationService.findByName("order-service")).willReturn(app);

		// when/then
		this.mockMvc.perform(get("/api/v1/applications/order-service"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.name").value("order-service"))
			.andExpect(jsonPath("$.description").value("Manages orders"))
			.andExpect(jsonPath("$.owner").value("team-commerce"));
	}

	@Test
	void should_return_404_when_application_not_found() throws Exception {
		// given
		given(this.applicationService.findByName("nonexistent"))
			.willThrow(new ApplicationNotFoundException("nonexistent"));

		// when/then
		this.mockMvc.perform(get("/api/v1/applications/nonexistent"))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("APPLICATION_NOT_FOUND"));
	}

	@Test
	void should_list_applications_paginated() throws Exception {
		// given
		Application app1 = Application.create("app-a", "desc", "owner");
		Application app2 = Application.create("app-b", "desc", "owner");
		PageImpl<Application> page = new PageImpl<>(List.of(app1, app2), PageRequest.of(0, 10, Sort.by("name")), 2);
		given(this.applicationService.findAll(any(), any())).willReturn(page);

		// when/then
		this.mockMvc.perform(get("/api/v1/applications?page=0&size=10&sort=name,asc"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.content", hasSize(2)))
			.andExpect(jsonPath("$.totalElements").value(2));
	}

	@Test
	void should_search_applications_by_name() throws Exception {
		// given
		Application app = Application.create("order-service", "desc", "owner");
		PageImpl<Application> page = new PageImpl<>(List.of(app));
		given(this.applicationService.findAll("order", PageRequest.of(0, 20))).willReturn(page);

		// when/then
		this.mockMvc.perform(get("/api/v1/applications?search=order"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.content", hasSize(1)))
			.andExpect(jsonPath("$.content[0].name").value("order-service"));
	}

	@Test
	void should_register_application_with_custom_main_branch() throws Exception {
		// given
		Application app = Application.create("order-service", "Manages orders", "team-commerce", "develop");
		given(this.applicationService.register("order-service", "Manages orders", "team-commerce", "develop"))
			.willReturn(app);

		// when/then
		this.mockMvc
			.perform(post("/api/v1/applications").contentType(MediaType.APPLICATION_JSON)
				.content(
						"""
								{"name": "order-service", "description": "Manages orders", "owner": "team-commerce", "mainBranch": "develop"}
								"""))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.mainBranch").value("develop"));
	}

	@Test
	void should_update_main_branch() throws Exception {
		// given
		Application app = Application.create("order-service", "desc", "owner", "develop");
		given(this.applicationService.updateMainBranch("order-service", "develop")).willReturn(app);

		// when/then
		this.mockMvc
			.perform(put("/api/v1/applications/order-service").contentType(MediaType.APPLICATION_JSON).content("""
					{"mainBranch": "develop"}
					"""))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.mainBranch").value("develop"));
	}

	@Test
	void should_return_400_when_main_branch_is_missing_on_update() throws Exception {
		this.mockMvc
			.perform(put("/api/v1/applications/order-service").contentType(MediaType.APPLICATION_JSON).content("{}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
	}

	@Test
	void should_delete_application_and_return_204() throws Exception {
		// given
		willDoNothing().given(this.applicationService).deleteByName("order-service");

		// when/then
		this.mockMvc.perform(delete("/api/v1/applications/order-service")).andExpect(status().isNoContent());
	}

	@Test
	void should_return_404_when_deleting_nonexistent() throws Exception {
		// given
		willThrow(new ApplicationNotFoundException("nonexistent")).given(this.applicationService)
			.deleteByName("nonexistent");

		// when/then
		this.mockMvc.perform(delete("/api/v1/applications/nonexistent")).andExpect(status().isNotFound());
	}

	@Test
	void should_list_versions_for_application() throws Exception {
		// given
		given(this.contractService.findVersionsByApplicationName("order-service"))
			.willReturn(List.of("1.0.0", "1.1.0", "2.0.0"));

		// when/then
		this.mockMvc.perform(get("/api/v1/applications/order-service/versions"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(3)))
			.andExpect(jsonPath("$[0]").value("1.0.0"))
			.andExpect(jsonPath("$[1]").value("1.1.0"))
			.andExpect(jsonPath("$[2]").value("2.0.0"));
	}

	@Test
	void should_return_empty_list_when_no_versions() throws Exception {
		// given
		given(this.contractService.findVersionsByApplicationName("new-service")).willReturn(List.of());

		// when/then
		this.mockMvc.perform(get("/api/v1/applications/new-service/versions"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(0)));
	}

	@Test
	void should_return_404_when_listing_versions_for_unknown_app() throws Exception {
		// given
		given(this.contractService.findVersionsByApplicationName("unknown"))
			.willThrow(new ApplicationNotFoundException("unknown"));

		// when/then
		this.mockMvc.perform(get("/api/v1/applications/unknown/versions"))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("APPLICATION_NOT_FOUND"));
	}

}
