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
package sh.stubborn.oss.mavenimport;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.micrometer.tracing.test.autoconfigure.AutoConfigureTracing;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willDoNothing;
import static org.mockito.BDDMockito.willThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(MavenImportController.class)
@AutoConfigureTracing
@WithMockUser(roles = "ADMIN")
class MavenImportControllerTest {

	@Autowired
	MockMvc mockMvc;

	@MockitoBean
	MavenImportService importService;

	@MockitoBean
	MavenStubsDiscoveryService discoveryService;

	@Test
	void should_import_jar_and_return_result() throws Exception {
		// given
		given(this.importService.importJar("order-service", "https://repo.example.com", "com.example", "order-stubs",
				"1.0.0", null, null))
			.willReturn(new MavenImportService.MavenImportResult(3, 1, 4));

		// when/then
		this.mockMvc.perform(post("/api/v1/import/maven-jar").contentType(MediaType.APPLICATION_JSON).content("""
				{
				  "applicationName": "order-service",
				  "repositoryUrl": "https://repo.example.com",
				  "groupId": "com.example",
				  "artifactId": "order-stubs",
				  "version": "1.0.0"
				}
				"""))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.published").value(3))
			.andExpect(jsonPath("$.skipped").value(1))
			.andExpect(jsonPath("$.total").value(4));
	}

	@Test
	void should_import_jar_with_credentials() throws Exception {
		// given
		given(this.importService.importJar("order-service", "https://repo.example.com", "com.example", "order-stubs",
				"1.0.0", "user", "pass"))
			.willReturn(new MavenImportService.MavenImportResult(2, 0, 2));

		// when/then
		this.mockMvc.perform(post("/api/v1/import/maven-jar").contentType(MediaType.APPLICATION_JSON).content("""
				{
				  "applicationName": "order-service",
				  "repositoryUrl": "https://repo.example.com",
				  "groupId": "com.example",
				  "artifactId": "order-stubs",
				  "version": "1.0.0",
				  "username": "user",
				  "password": "pass"
				}
				""")).andExpect(status().isOk()).andExpect(jsonPath("$.published").value(2));
	}

	@Test
	void should_return_400_when_application_name_is_missing() throws Exception {
		this.mockMvc.perform(post("/api/v1/import/maven-jar").contentType(MediaType.APPLICATION_JSON).content("""
				{
				  "repositoryUrl": "https://repo.example.com",
				  "groupId": "com.example",
				  "artifactId": "order-stubs",
				  "version": "1.0.0"
				}
				""")).andExpect(status().isBadRequest());
	}

	@Test
	void should_return_400_when_repository_url_is_missing() throws Exception {
		this.mockMvc.perform(post("/api/v1/import/maven-jar").contentType(MediaType.APPLICATION_JSON).content("""
				{
				  "applicationName": "order-service",
				  "groupId": "com.example",
				  "artifactId": "order-stubs",
				  "version": "1.0.0"
				}
				""")).andExpect(status().isBadRequest());
	}

	@Test
	void should_list_sources_paginated() throws Exception {
		// given
		MavenImportSource source = MavenImportSource.create("https://repo.example.com", "com.example", "order-stubs",
				null, null, true);
		PageImpl<MavenImportSource> page = new PageImpl<>(List.of(source), PageRequest.of(0, 20), 1);
		given(this.importService.listSources(any(Pageable.class))).willReturn(page);

		// when/then
		this.mockMvc.perform(get("/api/v1/import/sources"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.content", hasSize(1)))
			.andExpect(jsonPath("$.content[0].repositoryUrl").value("https://repo.example.com"))
			.andExpect(jsonPath("$.content[0].groupId").value("com.example"))
			.andExpect(jsonPath("$.content[0].artifactId").value("order-stubs"))
			.andExpect(jsonPath("$.content[0].syncEnabled").value(true));
	}

	@Test
	void should_register_source_and_return_201() throws Exception {
		// given
		MavenImportSource source = MavenImportSource.create("https://repo.example.com", "com.example", "order-stubs",
				null, null, true);
		given(this.importService.registerSource("https://repo.example.com", "com.example", "order-stubs", null, null,
				true))
			.willReturn(source);

		// when/then
		this.mockMvc.perform(post("/api/v1/import/sources").contentType(MediaType.APPLICATION_JSON).content("""
				{
				  "repositoryUrl": "https://repo.example.com",
				  "groupId": "com.example",
				  "artifactId": "order-stubs",
				  "syncEnabled": true
				}
				"""))
			.andExpect(status().isCreated())
			.andExpect(header().string("Location", "/api/v1/import/sources/" + source.getId()))
			.andExpect(jsonPath("$.repositoryUrl").value("https://repo.example.com"))
			.andExpect(jsonPath("$.groupId").value("com.example"));
	}

	@Test
	void should_return_400_when_registering_source_without_group_id() throws Exception {
		this.mockMvc.perform(post("/api/v1/import/sources").contentType(MediaType.APPLICATION_JSON).content("""
				{
				  "repositoryUrl": "https://repo.example.com",
				  "artifactId": "order-stubs",
				  "syncEnabled": true
				}
				""")).andExpect(status().isBadRequest());
	}

	@Test
	void should_get_source_by_id() throws Exception {
		// given
		UUID id = UUID.randomUUID();
		MavenImportSource source = MavenImportSource.create("https://repo.example.com", "com.example", "order-stubs",
				null, null, false);
		given(this.importService.getSource(id)).willReturn(source);

		// when/then
		this.mockMvc.perform(get("/api/v1/import/sources/" + id))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.repositoryUrl").value("https://repo.example.com"))
			.andExpect(jsonPath("$.syncEnabled").value(false));
	}

	@Test
	void should_return_404_when_source_not_found() throws Exception {
		// given
		UUID id = UUID.randomUUID();
		given(this.importService.getSource(id)).willThrow(new MavenImportSourceNotFoundException(id));

		// when/then
		this.mockMvc.perform(get("/api/v1/import/sources/" + id)).andExpect(status().isNotFound());
	}

	@Test
	void should_delete_source_and_return_204() throws Exception {
		// given
		UUID id = UUID.randomUUID();
		willDoNothing().given(this.importService).deleteSource(id);

		// when/then
		this.mockMvc.perform(delete("/api/v1/import/sources/" + id)).andExpect(status().isNoContent());
	}

	@Test
	void should_return_404_when_deleting_nonexistent_source() throws Exception {
		// given
		UUID id = UUID.randomUUID();
		willThrow(new MavenImportSourceNotFoundException(id)).given(this.importService).deleteSource(id);

		// when/then
		this.mockMvc.perform(delete("/api/v1/import/sources/" + id)).andExpect(status().isNotFound());
	}

}
