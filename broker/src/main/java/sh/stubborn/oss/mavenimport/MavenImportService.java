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

import io.micrometer.observation.annotation.Observed;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import sh.stubborn.oss.contract.ContractService;
import sh.stubborn.oss.security.CredentialEncryptionService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MavenImportService {

	private static final Logger logger = LoggerFactory.getLogger(MavenImportService.class);

	private final MavenImportSourceRepository sourceRepository;

	private final MavenJarDownloader jarDownloader;

	private final ContractService contractService;

	private final CredentialEncryptionService credentialEncryptionService;

	MavenImportService(MavenImportSourceRepository sourceRepository, MavenJarDownloader jarDownloader,
			ContractService contractService, CredentialEncryptionService credentialEncryptionService) {
		this.sourceRepository = sourceRepository;
		this.jarDownloader = jarDownloader;
		this.contractService = contractService;
		this.credentialEncryptionService = credentialEncryptionService;
	}

	@Observed(name = "broker.mavenimport.import-jar")
	@Transactional
	MavenImportResult importJar(String applicationName, String repositoryUrl, String groupId, String artifactId,
			String version, @Nullable String username, @Nullable String password) {
		List<MavenJarDownloader.ExtractedContract> extracted = this.jarDownloader.downloadAndExtract(repositoryUrl,
				groupId, artifactId, version, username, password);

		if (extracted.isEmpty()) {
			throw new MavenImportException(
					"No contracts found in stubs JAR for %s:%s:%s".formatted(groupId, artifactId, version));
		}

		int published = 0;
		int skipped = 0;
		for (MavenJarDownloader.ExtractedContract contract : extracted) {
			try {
				this.contractService.publish(applicationName, version, contract.contractName(), contract.content(),
						contract.contentType());
				published++;
			}
			catch (Exception ex) {
				logger.debug("Skipping duplicate or invalid contract {}: {}", contract.contractName(), ex.getMessage());
				skipped++;
			}
		}

		logger.info("Imported {} contracts (skipped {}) from {}:{}:{} for application {}", published, skipped, groupId,
				artifactId, version, applicationName);

		return new MavenImportResult(published, skipped, extracted.size());
	}

	Page<MavenImportSource> listSources(Pageable pageable) {
		return this.sourceRepository.findAll(pageable);
	}

	@Transactional
	MavenImportSource registerSource(String repositoryUrl, String groupId, String artifactId, @Nullable String username,
			@Nullable String encryptedPassword, boolean syncEnabled) {
		if (this.sourceRepository.existsByRepositoryUrlAndGroupIdAndArtifactId(repositoryUrl, groupId, artifactId)) {
			throw new MavenImportException(
					"Import source already exists for %s:%s at %s".formatted(groupId, artifactId, repositoryUrl));
		}
		String encrypted = this.credentialEncryptionService.encrypt(encryptedPassword);
		MavenImportSource source = MavenImportSource.create(repositoryUrl, groupId, artifactId, username, encrypted,
				syncEnabled);
		return this.sourceRepository.save(source);
	}

	MavenImportSource getSource(UUID id) {
		return this.sourceRepository.findById(id).orElseThrow(() -> new MavenImportSourceNotFoundException(id));
	}

	@Transactional
	void deleteSource(UUID id) {
		MavenImportSource source = getSource(id);
		this.sourceRepository.delete(source);
	}

	record MavenImportResult(int published, int skipped, int total) {
	}

}
