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
package org.springframework.cloud.contract.broker.environment;

import java.util.List;

import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.micrometer.tracing.test.autoconfigure.AutoConfigureTracing;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.BDDMockito.willDoNothing;
import static org.mockito.BDDMockito.willThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(EnvironmentController.class)
@AutoConfigureTracing
@WithMockUser(roles = "ADMIN")
class EnvironmentControllerTest {

	@Autowired
	MockMvc mockMvc;

	@MockitoBean
	EnvironmentService environmentService;

	@Test
	void should_create_environment_and_return_201() throws Exception {
		// given
		Environment env = Environment.create("staging", "Pre-production", 2, false);
		given(this.environmentService.create("staging", "Pre-production", 2, false)).willReturn(env);

		// when/then
		this.mockMvc.perform(post("/api/v1/environments").contentType(MediaType.APPLICATION_JSON).content("""
				{
				  "name": "staging",
				  "description": "Pre-production",
				  "displayOrder": 2,
				  "production": false
				}
				"""))
			.andExpect(status().isCreated())
			.andExpect(header().string("Location", "/api/v1/environments/staging"))
			.andExpect(jsonPath("$.name").value("staging"))
			.andExpect(jsonPath("$.description").value("Pre-production"))
			.andExpect(jsonPath("$.displayOrder").value(2))
			.andExpect(jsonPath("$.production").value(false));
	}

	@Test
	void should_return_409_when_environment_already_exists() throws Exception {
		// given
		given(this.environmentService.create("staging", "Pre-production", 2, false))
			.willThrow(new EnvironmentAlreadyExistsException("staging"));

		// when/then
		this.mockMvc.perform(post("/api/v1/environments").contentType(MediaType.APPLICATION_JSON).content("""
				{
				  "name": "staging",
				  "description": "Pre-production",
				  "displayOrder": 2,
				  "production": false
				}
				"""))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("ENVIRONMENT_ALREADY_EXISTS"));
	}

	@Test
	void should_return_400_when_name_is_blank() throws Exception {
		this.mockMvc.perform(post("/api/v1/environments").contentType(MediaType.APPLICATION_JSON).content("""
				{
				  "name": "",
				  "description": "Missing name",
				  "displayOrder": 0,
				  "production": false
				}
				""")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
	}

	@Test
	void should_list_all_environments() throws Exception {
		// given
		Environment dev = Environment.create("dev", "Development", 1, false);
		Environment prod = Environment.create("production", "Production", 3, true);
		given(this.environmentService.findAll()).willReturn(List.of(dev, prod));

		// when/then
		this.mockMvc.perform(get("/api/v1/environments"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(2)))
			.andExpect(jsonPath("$[0].name").value("dev"))
			.andExpect(jsonPath("$[1].name").value("production"))
			.andExpect(jsonPath("$[1].production").value(true));
	}

	@Test
	void should_get_environment_by_name() throws Exception {
		// given
		Environment env = Environment.create("staging", "Pre-production", 2, false);
		given(this.environmentService.findByName("staging")).willReturn(env);

		// when/then
		this.mockMvc.perform(get("/api/v1/environments/staging"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.name").value("staging"))
			.andExpect(jsonPath("$.description").value("Pre-production"));
	}

	@Test
	void should_return_404_when_environment_not_found() throws Exception {
		// given
		given(this.environmentService.findByName("unknown")).willThrow(new EnvironmentNotFoundException("unknown"));

		// when/then
		this.mockMvc.perform(get("/api/v1/environments/unknown"))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("ENVIRONMENT_NOT_FOUND"));
	}

	@Test
	void should_update_environment() throws Exception {
		// given
		Environment env = Environment.create("staging", "Updated desc", 5, true);
		given(this.environmentService.update("staging", "Updated desc", 5, true)).willReturn(env);

		// when/then
		this.mockMvc.perform(put("/api/v1/environments/staging").contentType(MediaType.APPLICATION_JSON).content("""
				{
				  "description": "Updated desc",
				  "displayOrder": 5,
				  "production": true
				}
				"""))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.name").value("staging"))
			.andExpect(jsonPath("$.description").value("Updated desc"));
	}

	@Test
	void should_delete_environment_and_return_204() throws Exception {
		// given
		willDoNothing().given(this.environmentService).deleteByName("staging");

		// when/then
		this.mockMvc.perform(delete("/api/v1/environments/staging")).andExpect(status().isNoContent());
		then(this.environmentService).should().deleteByName("staging");
	}

	@Test
	@WithMockUser(roles = "READER")
	void should_allow_reader_to_list_environments() throws Exception {
		// given
		given(this.environmentService.findAll()).willReturn(List.of());

		// when/then
		this.mockMvc.perform(get("/api/v1/environments")).andExpect(status().isOk());
	}

	@Test
	@WithMockUser(roles = "READER")
	void should_allow_reader_to_get_environment() throws Exception {
		// given
		Environment env = Environment.create("staging", "Pre-production", 2, false);
		given(this.environmentService.findByName("staging")).willReturn(env);

		// when/then
		this.mockMvc.perform(get("/api/v1/environments/staging"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.name").value("staging"));
	}

}
