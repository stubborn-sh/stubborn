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
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import sh.stubborn.oss.contract.ContractService;
import sh.stubborn.oss.security.CredentialEncryptionService;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/**
 * @see <a href="../../../docs/specs/029-git-import.md">Spec 029 — Git Import</a>
 */
@ExtendWith(MockitoExtension.class)
class GitImportServiceTest {

	@Mock
	GitImportSourceRepository sourceRepository;

	@Mock
	GitRepoCloner repoCloner;

	@Mock
	ContractService contractService;

	@Mock
	CredentialEncryptionService credentialEncryptionService;

	GitImportService service;

	@BeforeEach
	void setUp() {
		this.service = new GitImportService(this.sourceRepository, this.repoCloner, this.contractService,
				this.credentialEncryptionService);
	}

	@Test
	void should_import_from_git_and_publish_contracts() {
		// given
		List<GitRepoCloner.ExtractedContract> extracted = List.of(
				new GitRepoCloner.ExtractedContract("shouldReturnOrder.json", "{}", "application/json"),
				new GitRepoCloner.ExtractedContract("shouldCreateOrder.yml", "request: {}", "application/x-yaml"));
		given(this.repoCloner.cloneAndExtract("https://github.com/example/repo.git", "main",
				"src/test/resources/contracts/", "NONE", null, null))
			.willReturn(new GitRepoCloner.CloneResult(extracted, "abc1234"));

		// when
		GitImportService.GitImportResult result = this.service.importFromGit("order-service",
				"https://github.com/example/repo.git", "main", "src/test/resources/contracts/", null, "NONE", null,
				null);

		// then
		assertThat(result.published()).isEqualTo(2);
		assertThat(result.skipped()).isZero();
		assertThat(result.total()).isEqualTo(2);
		assertThat(result.resolvedVersion()).isEqualTo("abc1234");
		verify(this.contractService, times(2)).publish(eq("order-service"), eq("abc1234"), anyString(), anyString(),
				anyString());
	}

	@Test
	void should_use_caller_provided_version_over_auto_detected() {
		// given
		List<GitRepoCloner.ExtractedContract> extracted = List
			.of(new GitRepoCloner.ExtractedContract("contract.json", "{}", "application/json"));
		given(this.repoCloner.cloneAndExtract("https://github.com/example/repo.git", "main",
				"src/test/resources/contracts/", "NONE", null, null))
			.willReturn(new GitRepoCloner.CloneResult(extracted, "abc1234"));

		// when
		GitImportService.GitImportResult result = this.service.importFromGit("my-app",
				"https://github.com/example/repo.git", "main", "src/test/resources/contracts/", "2.0.0", "NONE", null,
				null);

		// then
		assertThat(result.resolvedVersion()).isEqualTo("2.0.0");
		verify(this.contractService).publish("my-app", "2.0.0", "contract.json", "{}", "application/json");
	}

	@Test
	void should_skip_duplicate_contracts_during_import() {
		// given
		List<GitRepoCloner.ExtractedContract> extracted = List.of(
				new GitRepoCloner.ExtractedContract("contract-a.json", "{}", "application/json"),
				new GitRepoCloner.ExtractedContract("contract-b.json", "{}", "application/json"));
		given(this.repoCloner.cloneAndExtract("https://github.com/example/repo.git", "main",
				"src/test/resources/contracts/", "NONE", null, null))
			.willReturn(new GitRepoCloner.CloneResult(extracted, "abc1234"));
		given(this.contractService.publish("my-app", "abc1234", "contract-a.json", "{}", "application/json"))
			.willThrow(new RuntimeException("duplicate"));

		// when
		GitImportService.GitImportResult result = this.service.importFromGit("my-app",
				"https://github.com/example/repo.git", "main", "src/test/resources/contracts/", null, "NONE", null,
				null);

		// then
		assertThat(result.published()).isEqualTo(1);
		assertThat(result.skipped()).isEqualTo(1);
		assertThat(result.total()).isEqualTo(2);
	}

	@Test
	void should_throw_when_no_contracts_found() {
		// given
		given(this.repoCloner.cloneAndExtract("https://github.com/example/repo.git", "main",
				"src/test/resources/contracts/", "NONE", null, null))
			.willReturn(new GitRepoCloner.CloneResult(List.of(), "abc1234"));

		// then
		assertThatThrownBy(() -> this.service.importFromGit("my-app", "https://github.com/example/repo.git", "main",
				"src/test/resources/contracts/", null, "NONE", null, null))
			.isInstanceOf(GitImportException.class)
			.hasMessageContaining("No contracts found");
	}

	@Test
	void should_use_defaults_when_optional_params_are_null() {
		// given
		List<GitRepoCloner.ExtractedContract> extracted = List
			.of(new GitRepoCloner.ExtractedContract("contract.json", "{}", "application/json"));
		given(this.repoCloner.cloneAndExtract("https://github.com/example/repo.git", "main",
				"src/test/resources/contracts/", "NONE", null, null))
			.willReturn(new GitRepoCloner.CloneResult(extracted, "abc1234"));

		// when
		GitImportService.GitImportResult result = this.service.importFromGit("my-app",
				"https://github.com/example/repo.git", null, null, null, null, null, null);

		// then
		assertThat(result.published()).isEqualTo(1);
		verify(this.repoCloner).cloneAndExtract("https://github.com/example/repo.git", "main",
				"src/test/resources/contracts/", "NONE", null, null);
	}

	@Test
	void should_list_sources_paginated() {
		// given
		GitImportSource source = GitImportSource.create("order-service", "https://github.com/example/repo.git", "main",
				"src/test/resources/contracts/", "NONE", null, null, true);
		Page<GitImportSource> page = new PageImpl<>(List.of(source));
		given(this.sourceRepository.findAll(any(PageRequest.class))).willReturn(page);

		// when
		Page<GitImportSource> result = this.service.listSources(PageRequest.of(0, 10));

		// then
		assertThat(result.getContent()).hasSize(1);
		assertThat(result.getContent().get(0).getApplicationName()).isEqualTo("order-service");
	}

	@Test
	void should_register_source_when_not_duplicate() {
		// given
		given(this.sourceRepository.existsByRepositoryUrlAndApplicationName("https://github.com/example/repo.git",
				"order-service"))
			.willReturn(false);
		given(this.sourceRepository.save(any(GitImportSource.class)))
			.willAnswer(invocation -> invocation.getArgument(0));

		// when
		GitImportSource result = this.service.registerSource("order-service", "https://github.com/example/repo.git",
				"main", "src/test/resources/contracts/", "NONE", null, null, true);

		// then
		assertThat(result.getRepositoryUrl()).isEqualTo("https://github.com/example/repo.git");
		assertThat(result.getApplicationName()).isEqualTo("order-service");
		assertThat(result.getBranch()).isEqualTo("main");
		assertThat(result.isSyncEnabled()).isTrue();
		verify(this.sourceRepository).save(any(GitImportSource.class));
	}

	@Test
	void should_encrypt_token_when_registering_source() {
		// given
		given(this.sourceRepository.existsByRepositoryUrlAndApplicationName("https://github.com/example/repo.git",
				"order-service"))
			.willReturn(false);
		given(this.credentialEncryptionService.encrypt("my-token")).willReturn("encrypted-token");
		given(this.sourceRepository.save(any(GitImportSource.class)))
			.willAnswer(invocation -> invocation.getArgument(0));

		// when
		GitImportSource result = this.service.registerSource("order-service", "https://github.com/example/repo.git",
				"main", "src/test/resources/contracts/", "HTTPS_TOKEN", null, "my-token", true);

		// then
		verify(this.credentialEncryptionService).encrypt("my-token");
		assertThat(result.getEncryptedToken()).isEqualTo("encrypted-token");
	}

	@Test
	void should_throw_when_registering_duplicate_source() {
		// given
		given(this.sourceRepository.existsByRepositoryUrlAndApplicationName("https://github.com/example/repo.git",
				"order-service"))
			.willReturn(true);

		// then
		assertThatThrownBy(() -> this.service.registerSource("order-service", "https://github.com/example/repo.git",
				"main", "src/test/resources/contracts/", "NONE", null, null, true))
			.isInstanceOf(GitImportException.class)
			.hasMessageContaining("already exists");
	}

	@Test
	void should_get_source_by_id() {
		// given
		UUID id = UUID.randomUUID();
		GitImportSource source = GitImportSource.create("order-service", "https://github.com/example/repo.git", "main",
				"src/test/resources/contracts/", "NONE", null, null, true);
		given(this.sourceRepository.findById(id)).willReturn(Optional.of(source));

		// when
		GitImportSource result = this.service.getSource(id);

		// then
		assertThat(result.getApplicationName()).isEqualTo("order-service");
	}

	@Test
	void should_throw_when_source_not_found() {
		// given
		UUID id = UUID.randomUUID();
		given(this.sourceRepository.findById(id)).willReturn(Optional.empty());

		// then
		assertThatThrownBy(() -> this.service.getSource(id)).isInstanceOf(GitImportSourceNotFoundException.class)
			.hasMessageContaining(id.toString());
	}

	@Test
	void should_delete_source_by_id() {
		// given
		UUID id = UUID.randomUUID();
		GitImportSource source = GitImportSource.create("order-service", "https://github.com/example/repo.git", "main",
				"src/test/resources/contracts/", "NONE", null, null, true);
		given(this.sourceRepository.findById(id)).willReturn(Optional.of(source));

		// when
		this.service.deleteSource(id);

		// then
		verify(this.sourceRepository).delete(source);
	}

	@Test
	void should_throw_when_deleting_nonexistent_source() {
		// given
		UUID id = UUID.randomUUID();
		given(this.sourceRepository.findById(id)).willReturn(Optional.empty());

		// then
		assertThatThrownBy(() -> this.service.deleteSource(id)).isInstanceOf(GitImportSourceNotFoundException.class);
	}

	@Test
	void should_pass_credentials_when_importing() {
		// given
		List<GitRepoCloner.ExtractedContract> extracted = List
			.of(new GitRepoCloner.ExtractedContract("contract.json", "{}", "application/json"));
		given(this.repoCloner.cloneAndExtract("https://github.com/example/repo.git", "main",
				"src/test/resources/contracts/", "HTTPS_TOKEN", null, "my-token"))
			.willReturn(new GitRepoCloner.CloneResult(extracted, "abc1234"));

		// when
		GitImportService.GitImportResult result = this.service.importFromGit("my-app",
				"https://github.com/example/repo.git", "main", "src/test/resources/contracts/", null, "HTTPS_TOKEN",
				null, "my-token");

		// then
		assertThat(result.published()).isEqualTo(1);
		verify(this.repoCloner).cloneAndExtract("https://github.com/example/repo.git", "main",
				"src/test/resources/contracts/", "HTTPS_TOKEN", null, "my-token");
	}

}
