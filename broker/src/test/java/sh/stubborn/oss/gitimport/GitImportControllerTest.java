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
package sh.stubborn.oss.gitimport;

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

@WebMvcTest(GitImportController.class)
@AutoConfigureTracing
@WithMockUser(roles = "ADMIN")
class GitImportControllerTest {

	@Autowired
	MockMvc mockMvc;

	@MockitoBean
	GitImportService importService;

	@Test
	void should_import_from_git_and_return_result() throws Exception {
		// given
		given(this.importService.importFromGit("order-service", "https://github.com/example/repo.git", "main",
				"src/test/resources/contracts/", null, "NONE", null, null))
			.willReturn(new GitImportService.GitImportResult(3, 1, 4, "v1.0.0"));

		// when/then
		this.mockMvc.perform(post("/api/v1/import/git").contentType(MediaType.APPLICATION_JSON).content("""
				{
				  "applicationName": "order-service",
				  "repositoryUrl": "https://github.com/example/repo.git",
				  "branch": "main",
				  "contractsDirectory": "src/test/resources/contracts/",
				  "authType": "NONE"
				}
				"""))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.published").value(3))
			.andExpect(jsonPath("$.skipped").value(1))
			.andExpect(jsonPath("$.total").value(4))
			.andExpect(jsonPath("$.resolvedVersion").value("v1.0.0"));
	}

	@Test
	void should_import_with_version_override() throws Exception {
		// given
		given(this.importService.importFromGit("order-service", "https://github.com/example/repo.git", "main", null,
				"2.0.0", null, null, null))
			.willReturn(new GitImportService.GitImportResult(2, 0, 2, "2.0.0"));

		// when/then
		this.mockMvc.perform(post("/api/v1/import/git").contentType(MediaType.APPLICATION_JSON).content("""
				{
				  "applicationName": "order-service",
				  "repositoryUrl": "https://github.com/example/repo.git",
				  "branch": "main",
				  "version": "2.0.0"
				}
				"""))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.published").value(2))
			.andExpect(jsonPath("$.resolvedVersion").value("2.0.0"));
	}

	@Test
	void should_return_400_when_application_name_is_missing() throws Exception {
		this.mockMvc.perform(post("/api/v1/import/git").contentType(MediaType.APPLICATION_JSON).content("""
				{
				  "repositoryUrl": "https://github.com/example/repo.git"
				}
				""")).andExpect(status().isBadRequest());
	}

	@Test
	void should_return_400_when_repository_url_is_missing() throws Exception {
		this.mockMvc.perform(post("/api/v1/import/git").contentType(MediaType.APPLICATION_JSON).content("""
				{
				  "applicationName": "order-service"
				}
				""")).andExpect(status().isBadRequest());
	}

	@Test
	void should_list_git_sources_paginated() throws Exception {
		// given
		GitImportSource source = GitImportSource.create("order-service", "https://github.com/example/repo.git", "main",
				"src/test/resources/contracts/", "NONE", null, null, true);
		PageImpl<GitImportSource> page = new PageImpl<>(List.of(source), PageRequest.of(0, 20), 1);
		given(this.importService.listSources(any(Pageable.class))).willReturn(page);

		// when/then
		this.mockMvc.perform(get("/api/v1/import/git-sources"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.content", hasSize(1)))
			.andExpect(jsonPath("$.content[0].repositoryUrl").value("https://github.com/example/repo.git"))
			.andExpect(jsonPath("$.content[0].applicationName").value("order-service"))
			.andExpect(jsonPath("$.content[0].branch").value("main"))
			.andExpect(jsonPath("$.content[0].syncEnabled").value(true));
	}

	@Test
	void should_register_git_source_and_return_201() throws Exception {
		// given
		GitImportSource source = GitImportSource.create("order-service", "https://github.com/example/repo.git", "main",
				"src/test/resources/contracts/", "NONE", null, null, true);
		given(this.importService.registerSource("order-service", "https://github.com/example/repo.git", "main",
				"src/test/resources/contracts/", "NONE", null, null, true))
			.willReturn(source);

		// when/then
		this.mockMvc.perform(post("/api/v1/import/git-sources").contentType(MediaType.APPLICATION_JSON).content("""
				{
				  "applicationName": "order-service",
				  "repositoryUrl": "https://github.com/example/repo.git",
				  "branch": "main",
				  "contractsDirectory": "src/test/resources/contracts/",
				  "authType": "NONE",
				  "syncEnabled": true
				}
				"""))
			.andExpect(status().isCreated())
			.andExpect(header().string("Location", "/api/v1/import/git-sources/" + source.getId()))
			.andExpect(jsonPath("$.repositoryUrl").value("https://github.com/example/repo.git"))
			.andExpect(jsonPath("$.applicationName").value("order-service"));
	}

	@Test
	void should_return_400_when_registering_source_without_application_name() throws Exception {
		this.mockMvc.perform(post("/api/v1/import/git-sources").contentType(MediaType.APPLICATION_JSON).content("""
				{
				  "repositoryUrl": "https://github.com/example/repo.git",
				  "syncEnabled": true
				}
				""")).andExpect(status().isBadRequest());
	}

	@Test
	void should_get_git_source_by_id() throws Exception {
		// given
		UUID id = UUID.randomUUID();
		GitImportSource source = GitImportSource.create("order-service", "https://github.com/example/repo.git", "main",
				"src/test/resources/contracts/", "NONE", null, null, false);
		given(this.importService.getSource(id)).willReturn(source);

		// when/then
		this.mockMvc.perform(get("/api/v1/import/git-sources/" + id))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.repositoryUrl").value("https://github.com/example/repo.git"))
			.andExpect(jsonPath("$.syncEnabled").value(false));
	}

	@Test
	void should_return_404_when_git_source_not_found() throws Exception {
		// given
		UUID id = UUID.randomUUID();
		given(this.importService.getSource(id)).willThrow(new GitImportSourceNotFoundException(id));

		// when/then
		this.mockMvc.perform(get("/api/v1/import/git-sources/" + id)).andExpect(status().isNotFound());
	}

	@Test
	void should_delete_git_source_and_return_204() throws Exception {
		// given
		UUID id = UUID.randomUUID();
		willDoNothing().given(this.importService).deleteSource(id);

		// when/then
		this.mockMvc.perform(delete("/api/v1/import/git-sources/" + id)).andExpect(status().isNoContent());
	}

	@Test
	void should_return_404_when_deleting_nonexistent_git_source() throws Exception {
		// given
		UUID id = UUID.randomUUID();
		willThrow(new GitImportSourceNotFoundException(id)).given(this.importService).deleteSource(id);

		// when/then
		this.mockMvc.perform(delete("/api/v1/import/git-sources/" + id)).andExpect(status().isNotFound());
	}

}
