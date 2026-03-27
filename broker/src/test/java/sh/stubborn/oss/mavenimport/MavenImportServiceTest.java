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
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class MavenImportServiceTest {

	@Mock
	MavenImportSourceRepository sourceRepository;

	@Mock
	MavenJarDownloader jarDownloader;

	@Mock
	ContractService contractService;

	@Mock
	CredentialEncryptionService credentialEncryptionService;

	MavenImportService service;

	@BeforeEach
	void setUp() {
		this.service = new MavenImportService(this.sourceRepository, this.jarDownloader, this.contractService,
				this.credentialEncryptionService);
	}

	@Test
	void should_import_jar_and_publish_contracts() {
		// given
		List<MavenJarDownloader.ExtractedContract> extracted = List.of(
				new MavenJarDownloader.ExtractedContract("shouldReturnOrder.json", "{}", "application/json"),
				new MavenJarDownloader.ExtractedContract("shouldCreateOrder.yml", "request: {}", "application/x-yaml"));
		given(this.jarDownloader.downloadAndExtract("https://repo.example.com", "com.example", "order-service", "1.0.0",
				null, null))
			.willReturn(extracted);

		// when
		MavenImportService.MavenImportResult result = this.service.importJar("order-service",
				"https://repo.example.com", "com.example", "order-service", "1.0.0", null, null);

		// then
		assertThat(result.published()).isEqualTo(2);
		assertThat(result.skipped()).isZero();
		assertThat(result.total()).isEqualTo(2);
		verify(this.contractService, times(2)).publish(eq("order-service"), eq("1.0.0"), anyString(), anyString(),
				anyString());
	}

	@Test
	void should_skip_duplicate_contracts_during_import() {
		// given
		List<MavenJarDownloader.ExtractedContract> extracted = List.of(
				new MavenJarDownloader.ExtractedContract("contract-a.json", "{}", "application/json"),
				new MavenJarDownloader.ExtractedContract("contract-b.json", "{}", "application/json"));
		given(this.jarDownloader.downloadAndExtract("https://repo.example.com", "com.example", "svc", "1.0.0", null,
				null))
			.willReturn(extracted);
		given(this.contractService.publish("my-app", "1.0.0", "contract-a.json", "{}", "application/json"))
			.willThrow(new RuntimeException("duplicate"));

		// when
		MavenImportService.MavenImportResult result = this.service.importJar("my-app", "https://repo.example.com",
				"com.example", "svc", "1.0.0", null, null);

		// then
		assertThat(result.published()).isEqualTo(1);
		assertThat(result.skipped()).isEqualTo(1);
		assertThat(result.total()).isEqualTo(2);
	}

	@Test
	void should_throw_when_no_contracts_found_in_jar() {
		// given
		given(this.jarDownloader.downloadAndExtract("https://repo.example.com", "com.example", "svc", "1.0.0", null,
				null))
			.willReturn(List.of());

		// then
		assertThatThrownBy(() -> this.service.importJar("my-app", "https://repo.example.com", "com.example", "svc",
				"1.0.0", null, null))
			.isInstanceOf(MavenImportException.class)
			.hasMessageContaining("No contracts found");
	}

	@Test
	void should_list_sources_paginated() {
		// given
		MavenImportSource source = MavenImportSource.create("https://repo.example.com", "com.example", "svc", null,
				null, true);
		Page<MavenImportSource> page = new PageImpl<>(List.of(source));
		given(this.sourceRepository.findAll(any(PageRequest.class))).willReturn(page);

		// when
		Page<MavenImportSource> result = this.service.listSources(PageRequest.of(0, 10));

		// then
		assertThat(result.getContent()).hasSize(1);
		assertThat(result.getContent().get(0).getGroupId()).isEqualTo("com.example");
	}

	@Test
	void should_register_source_when_not_duplicate() {
		// given
		given(this.sourceRepository.existsByRepositoryUrlAndGroupIdAndArtifactId("https://repo.example.com",
				"com.example", "svc"))
			.willReturn(false);
		given(this.sourceRepository.save(any(MavenImportSource.class)))
			.willAnswer(invocation -> invocation.getArgument(0));

		// when
		MavenImportSource result = this.service.registerSource("https://repo.example.com", "com.example", "svc", null,
				null, true);

		// then
		assertThat(result.getRepositoryUrl()).isEqualTo("https://repo.example.com");
		assertThat(result.getGroupId()).isEqualTo("com.example");
		assertThat(result.getArtifactId()).isEqualTo("svc");
		assertThat(result.isSyncEnabled()).isTrue();
		verify(this.sourceRepository).save(any(MavenImportSource.class));
	}

	@Test
	void should_encrypt_password_when_registering_source() {
		// given
		given(this.sourceRepository.existsByRepositoryUrlAndGroupIdAndArtifactId("https://repo.example.com",
				"com.example", "svc"))
			.willReturn(false);
		given(this.credentialEncryptionService.encrypt("my-secret")).willReturn("encrypted-secret");
		given(this.sourceRepository.save(any(MavenImportSource.class)))
			.willAnswer(invocation -> invocation.getArgument(0));

		// when
		MavenImportSource result = this.service.registerSource("https://repo.example.com", "com.example", "svc", "user",
				"my-secret", true);

		// then
		verify(this.credentialEncryptionService).encrypt("my-secret");
		assertThat(result.getEncryptedPassword()).isEqualTo("encrypted-secret");
	}

	@Test
	void should_throw_when_registering_duplicate_source() {
		// given
		given(this.sourceRepository.existsByRepositoryUrlAndGroupIdAndArtifactId("https://repo.example.com",
				"com.example", "svc"))
			.willReturn(true);

		// then
		assertThatThrownBy(
				() -> this.service.registerSource("https://repo.example.com", "com.example", "svc", null, null, true))
			.isInstanceOf(MavenImportException.class)
			.hasMessageContaining("already exists");
	}

	@Test
	void should_get_source_by_id() {
		// given
		UUID id = UUID.randomUUID();
		MavenImportSource source = MavenImportSource.create("https://repo.example.com", "com.example", "svc", null,
				null, true);
		given(this.sourceRepository.findById(id)).willReturn(Optional.of(source));

		// when
		MavenImportSource result = this.service.getSource(id);

		// then
		assertThat(result.getGroupId()).isEqualTo("com.example");
	}

	@Test
	void should_throw_when_source_not_found() {
		// given
		UUID id = UUID.randomUUID();
		given(this.sourceRepository.findById(id)).willReturn(Optional.empty());

		// then
		assertThatThrownBy(() -> this.service.getSource(id)).isInstanceOf(MavenImportSourceNotFoundException.class)
			.hasMessageContaining(id.toString());
	}

	@Test
	void should_delete_source_by_id() {
		// given
		UUID id = UUID.randomUUID();
		MavenImportSource source = MavenImportSource.create("https://repo.example.com", "com.example", "svc", null,
				null, true);
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
		assertThatThrownBy(() -> this.service.deleteSource(id)).isInstanceOf(MavenImportSourceNotFoundException.class);
	}

	@Test
	void should_pass_credentials_when_importing_jar() {
		// given
		List<MavenJarDownloader.ExtractedContract> extracted = List
			.of(new MavenJarDownloader.ExtractedContract("contract.json", "{}", "application/json"));
		given(this.jarDownloader.downloadAndExtract("https://repo.example.com", "com.example", "svc", "1.0.0", "user",
				"pass"))
			.willReturn(extracted);

		// when
		MavenImportService.MavenImportResult result = this.service.importJar("my-app", "https://repo.example.com",
				"com.example", "svc", "1.0.0", "user", "pass");

		// then
		assertThat(result.published()).isEqualTo(1);
		verify(this.jarDownloader).downloadAndExtract("https://repo.example.com", "com.example", "svc", "1.0.0", "user",
				"pass");
	}

}
