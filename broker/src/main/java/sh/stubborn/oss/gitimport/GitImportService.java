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

import io.micrometer.observation.annotation.Observed;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import sh.stubborn.oss.contract.ContractService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GitImportService {

	private static final Logger logger = LoggerFactory.getLogger(GitImportService.class);

	private static final String DEFAULT_BRANCH = "main";

	private static final String DEFAULT_CONTRACTS_DIR = "src/test/resources/contracts/";

	private static final String DEFAULT_AUTH_TYPE = "NONE";

	private final GitImportSourceRepository sourceRepository;

	private final GitRepoCloner repoCloner;

	private final ContractService contractService;

	GitImportService(GitImportSourceRepository sourceRepository, GitRepoCloner repoCloner,
			ContractService contractService) {
		this.sourceRepository = sourceRepository;
		this.repoCloner = repoCloner;
		this.contractService = contractService;
	}

	@Observed(name = "broker.gitimport.import-repo")
	@Transactional
	GitImportResult importFromGit(String applicationName, String repositoryUrl, @Nullable String branch,
			@Nullable String contractsDirectory, @Nullable String version, @Nullable String authType,
			@Nullable String username, @Nullable String token) {
		String effectiveBranch = branch != null ? branch : DEFAULT_BRANCH;
		String effectiveDir = contractsDirectory != null ? contractsDirectory : DEFAULT_CONTRACTS_DIR;
		String effectiveAuthType = authType != null ? authType : DEFAULT_AUTH_TYPE;

		GitRepoCloner.CloneResult cloneResult = this.repoCloner.cloneAndExtract(repositoryUrl, effectiveBranch,
				effectiveDir, effectiveAuthType, username, token);

		List<GitRepoCloner.ExtractedContract> extracted = cloneResult.contracts();
		if (extracted.isEmpty()) {
			throw new GitImportException("No contracts found in repository %s (branch: %s, directory: %s)"
				.formatted(repositoryUrl, effectiveBranch, effectiveDir));
		}

		String resolvedVersion = version != null ? version : cloneResult.resolvedVersion();

		int published = 0;
		int skipped = 0;
		for (GitRepoCloner.ExtractedContract contract : extracted) {
			try {
				this.contractService.publish(applicationName, resolvedVersion, contract.contractName(),
						contract.content(), contract.contentType());
				published++;
			}
			catch (Exception ex) {
				logger.debug("Skipping duplicate or invalid contract {}: {}", contract.contractName(), ex.getMessage());
				skipped++;
			}
		}

		logger.info("Imported {} contracts (skipped {}) from {} for application {}", published, skipped, repositoryUrl,
				applicationName);

		return new GitImportResult(published, skipped, extracted.size(), resolvedVersion);
	}

	Page<GitImportSource> listSources(Pageable pageable) {
		return this.sourceRepository.findAll(pageable);
	}

	@Transactional
	GitImportSource registerSource(String applicationName, String repositoryUrl, @Nullable String branch,
			@Nullable String contractsDirectory, @Nullable String authType, @Nullable String username,
			@Nullable String encryptedToken, boolean syncEnabled) {
		if (this.sourceRepository.existsByRepositoryUrlAndApplicationName(repositoryUrl, applicationName)) {
			throw new GitImportException(
					"Git import source already exists for %s at %s".formatted(applicationName, repositoryUrl));
		}
		String effectiveBranch = branch != null ? branch : DEFAULT_BRANCH;
		String effectiveDir = contractsDirectory != null ? contractsDirectory : DEFAULT_CONTRACTS_DIR;
		String effectiveAuthType = authType != null ? authType : DEFAULT_AUTH_TYPE;

		GitImportSource source = GitImportSource.create(applicationName, repositoryUrl, effectiveBranch, effectiveDir,
				effectiveAuthType, username, encryptedToken, syncEnabled);
		return this.sourceRepository.save(source);
	}

	GitImportSource getSource(UUID id) {
		return this.sourceRepository.findById(id).orElseThrow(() -> new GitImportSourceNotFoundException(id));
	}

	@Transactional
	void deleteSource(UUID id) {
		GitImportSource source = getSource(id);
		this.sourceRepository.delete(source);
	}

	record GitImportResult(int published, int skipped, int total, String resolvedVersion) {
	}

}
