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
package sh.stubborn.oss.verification;

import java.util.List;
import java.util.UUID;

import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.micrometer.observation.annotation.Observed;
import org.jspecify.annotations.Nullable;

import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import sh.stubborn.oss.application.ApplicationService;
import sh.stubborn.oss.contract.ContractVersion;
import sh.stubborn.oss.webhook.BrokerEvent;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class VerificationService {

	private final VerificationRepository verificationRepository;

	private final ApplicationService applicationService;

	private final ApplicationEventPublisher eventPublisher;

	private final VerificationMatcher verificationMatcher;

	VerificationService(VerificationRepository verificationRepository, ApplicationService applicationService,
			ApplicationEventPublisher eventPublisher, VerificationMatcher verificationMatcher) {
		this.verificationRepository = verificationRepository;
		this.applicationService = applicationService;
		this.eventPublisher = eventPublisher;
		this.verificationMatcher = verificationMatcher;
	}

	@CircuitBreaker(name = "database")
	@Observed(name = "broker.verification.record")
	@Transactional
	@Caching(evict = { @CacheEvict(cacheNames = "verifications", allEntries = true),
			@CacheEvict(cacheNames = "graph", allEntries = true), @CacheEvict(cacheNames = "matrix", allEntries = true),
			@CacheEvict(cacheNames = "safety", allEntries = true) })
	public Verification record(String providerName, String providerVersion, String consumerName, String consumerVersion,
			String status, @Nullable String details, @Nullable String branch) {
		ContractVersion.of(providerVersion);
		ContractVersion.of(consumerVersion);
		UUID providerId = this.applicationService.findIdByName(providerName);
		UUID consumerId = this.applicationService.findIdByName(consumerName);
		if (this.verificationRepository.existsByProviderIdAndProviderVersionAndConsumerIdAndConsumerVersion(providerId,
				providerVersion, consumerId, consumerVersion)) {
			throw new VerificationAlreadyExistsException(providerName, providerVersion, consumerName, consumerVersion);
		}
		VerificationStatus verificationStatus = VerificationStatus.valueOf(status);
		Verification verification = Verification.create(providerId, providerVersion, consumerId, consumerVersion,
				verificationStatus, details, branch);
		Verification saved = this.verificationRepository.save(verification);
		this.eventPublisher.publishEvent(
				BrokerEvent.verificationPublished(providerId, providerName, providerVersion, consumerName, status));
		if (verificationStatus == VerificationStatus.SUCCESS) {
			this.eventPublisher.publishEvent(
					BrokerEvent.verificationSucceeded(providerId, providerName, providerVersion, consumerName));
		}
		else if (verificationStatus == VerificationStatus.FAILED) {
			this.eventPublisher
				.publishEvent(BrokerEvent.verificationFailed(providerId, providerName, providerVersion, consumerName));
		}
		return saved;
	}

	public Verification record(String providerName, String providerVersion, String consumerName, String consumerVersion,
			String status, @Nullable String details) {
		return record(providerName, providerVersion, consumerName, consumerVersion, status, details, null);
	}

	@CircuitBreaker(name = "database")
	public List<Verification> findByProviderAndVersion(String providerName, String providerVersion) {
		UUID providerId = this.applicationService.findIdByName(providerName);
		return this.verificationRepository.findByProviderIdAndProviderVersion(providerId, providerVersion);
	}

	public Verification findById(UUID id) {
		return this.verificationRepository.findById(id).orElseThrow(() -> new VerificationNotFoundException(id));
	}

	public List<Verification> findAll() {
		return this.verificationRepository.findAll();
	}

	public Page<Verification> findAll(@Nullable String search, Pageable pageable) {
		if (search != null && !search.isBlank()) {
			return this.verificationRepository.searchByProviderOrConsumer(search.strip(), pageable);
		}
		return this.verificationRepository.findAll(pageable);
	}

	public Page<Verification> findAll(Pageable pageable) {
		return findAll(null, pageable);
	}

	public Page<Verification> findByProviderAndVersion(String providerName, String providerVersion, Pageable pageable) {
		UUID providerId = this.applicationService.findIdByName(providerName);
		return this.verificationRepository.findByProviderIdAndProviderVersion(providerId, providerVersion, pageable);
	}

	public boolean hasSuccessfulVerification(UUID providerId, String providerVersion, UUID consumerId,
			String consumerVersion) {
		return this.verificationMatcher.hasSuccessfulVerification(providerId, providerVersion, consumerId,
				consumerVersion);
	}

	public String resolveApplicationName(UUID applicationId) {
		return this.applicationService.findNameById(applicationId);
	}

	public List<VerificationInfo> findInfoByProviderId(UUID providerId) {
		return this.verificationRepository.findByProviderId(providerId).stream().map(VerificationInfo::from).toList();
	}

	public List<VerificationInfo> findInfoByConsumerId(UUID consumerId) {
		return this.verificationRepository.findByConsumerId(consumerId).stream().map(VerificationInfo::from).toList();
	}

	@Cacheable(cacheNames = "verifications", key = "'allInfo'")
	public List<VerificationInfo> findAllInfo() {
		return this.verificationRepository.findAll().stream().map(VerificationInfo::from).toList();
	}

	@Cacheable(cacheNames = "verifications", key = "'count'")
	public long count() {
		return this.verificationRepository.count();
	}

	public double computeSuccessRatio() {
		long total = count();
		if (total == 0) {
			return 0.0;
		}
		long successes = this.verificationRepository.findAll()
			.stream()
			.filter(v -> v.getStatus() == VerificationStatus.SUCCESS)
			.count();
		return (double) successes / total;
	}

}
