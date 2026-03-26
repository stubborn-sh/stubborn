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
package sh.stubborn.oss.contract;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.micrometer.observation.annotation.Observed;
import org.jspecify.annotations.Nullable;

import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import sh.stubborn.oss.application.ApplicationService;
import sh.stubborn.oss.webhook.BrokerEvent;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ContractService {

	private final ContractRepository contractRepository;

	private final ApplicationService applicationService;

	private final ApplicationEventPublisher eventPublisher;

	ContractService(ContractRepository contractRepository, ApplicationService applicationService,
			ApplicationEventPublisher eventPublisher) {
		this.contractRepository = contractRepository;
		this.applicationService = applicationService;
		this.eventPublisher = eventPublisher;
	}

	@CircuitBreaker(name = "database")
	@Observed(name = "broker.contract.publish")
	@Transactional
	@CacheEvict(cacheNames = "contracts", allEntries = true)
	public Contract publish(String applicationName, String version, String contractName, String content,
			String contentType, @Nullable String branch) {
		ContractVersion.of(version);
		if (branch != null) {
			BranchName.of(branch);
		}
		UUID applicationId = this.applicationService.findIdByName(applicationName);
		if (this.contractRepository.existsByApplicationIdAndVersionAndContractName(applicationId, version,
				contractName)) {
			throw new ContractAlreadyExistsException(applicationName, version, contractName);
		}
		String contentHash = computeContentHash(content);
		Contract contract = Contract.create(applicationId, version, contractName, content, contentType, branch,
				contentHash);
		Contract saved = this.contractRepository.save(contract);
		this.eventPublisher
			.publishEvent(BrokerEvent.contractPublished(applicationId, applicationName, version, contractName));
		return saved;
	}

	public Contract publish(String applicationName, String version, String contractName, String content,
			String contentType) {
		return publish(applicationName, version, contractName, content, contentType, null);
	}

	@CircuitBreaker(name = "database")
	public List<Contract> findByApplicationAndVersion(String applicationName, String version) {
		UUID applicationId = this.applicationService.findIdByName(applicationName);
		return this.contractRepository.findByApplicationIdAndVersion(applicationId, version);
	}

	public Page<Contract> findByApplicationAndVersion(String applicationName, String version, Pageable pageable) {
		UUID applicationId = this.applicationService.findIdByName(applicationName);
		return this.contractRepository.findByApplicationIdAndVersion(applicationId, version, pageable);
	}

	public Contract findByApplicationAndVersionAndName(String applicationName, String version, String contractName) {
		UUID applicationId = this.applicationService.findIdByName(applicationName);
		return this.contractRepository
			.findByApplicationIdAndVersionAndContractName(applicationId, version, contractName)
			.orElseThrow(() -> new ContractNotFoundException(applicationName, version, contractName));
	}

	@Cacheable(cacheNames = "contracts", key = "'count'")
	public long count() {
		return this.contractRepository.count();
	}

	public List<Contract> findByApplicationAndBranch(String applicationName, String branch) {
		UUID applicationId = this.applicationService.findIdByName(applicationName);
		return this.contractRepository.findByApplicationIdAndBranch(applicationId, branch);
	}

	public List<ContractInfo> findInfoByApplicationAndBranch(String applicationName, String branch) {
		return findByApplicationAndBranch(applicationName, branch).stream().map(ContractInfo::from).toList();
	}

	public List<ContractInfo> findInfoByApplicationAndVersion(String applicationName, String version) {
		return findByApplicationAndVersion(applicationName, version).stream().map(ContractInfo::from).toList();
	}

	public List<Contract> findByContentHash(String applicationName, String contentHash) {
		UUID applicationId = this.applicationService.findIdByName(applicationName);
		return this.contractRepository.findByApplicationIdAndContentHash(applicationId, contentHash);
	}

	public List<String> findVersionsByApplicationName(String applicationName) {
		UUID applicationId = this.applicationService.findIdByName(applicationName);
		return this.contractRepository.findDistinctVersionsByApplicationId(applicationId);
	}

	@Transactional
	public void delete(String applicationName, String version, String contractName) {
		Contract contract = findByApplicationAndVersionAndName(applicationName, version, contractName);
		this.contractRepository.delete(contract);
	}

	static String computeContentHash(String content) {
		try {
			MessageDigest digest = MessageDigest.getInstance("SHA-256");
			byte[] hash = digest.digest(content.getBytes(StandardCharsets.UTF_8));
			return HexFormat.of().formatHex(hash);
		}
		catch (NoSuchAlgorithmException ex) {
			throw new IllegalStateException("SHA-256 algorithm not available", ex);
		}
	}

}
