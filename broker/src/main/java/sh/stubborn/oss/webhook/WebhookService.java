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
package sh.stubborn.oss.webhook;

import java.util.UUID;

import io.micrometer.observation.annotation.Observed;
import org.jspecify.annotations.Nullable;

import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import sh.stubborn.oss.application.ApplicationService;
import sh.stubborn.oss.security.CredentialEncryptionService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WebhookService {

	private final WebhookRepository webhookRepository;

	private final WebhookExecutionRepository executionRepository;

	private final ApplicationService applicationService;

	private final CredentialEncryptionService encryptionService;

	WebhookService(WebhookRepository webhookRepository, WebhookExecutionRepository executionRepository,
			ApplicationService applicationService, CredentialEncryptionService encryptionService) {
		this.webhookRepository = webhookRepository;
		this.executionRepository = executionRepository;
		this.applicationService = applicationService;
		this.encryptionService = encryptionService;
	}

	@Observed(name = "broker.webhook.create")
	@Transactional
	@CacheEvict(cacheNames = "webhooks", allEntries = true)
	public Webhook create(@Nullable String applicationName, EventType eventType, String url, @Nullable String headers,
			@Nullable String bodyTemplate) {
		UUID applicationId = null;
		if (applicationName != null) {
			applicationId = this.applicationService.findIdByName(applicationName);
		}
		String encryptedHeaders = (headers != null) ? this.encryptionService.encrypt(headers) : null;
		Webhook webhook = Webhook.create(applicationId, eventType, url, encryptedHeaders, bodyTemplate);
		return this.webhookRepository.save(webhook);
	}

	public Webhook findById(UUID id) {
		return this.webhookRepository.findById(id).orElseThrow(() -> new WebhookNotFoundException(id));
	}

	public Page<Webhook> findAll(@Nullable String search, Pageable pageable) {
		if (search != null && !search.isBlank()) {
			return this.webhookRepository.searchByEventTypeOrUrl(search.strip(), pageable);
		}
		return this.webhookRepository.findAll(pageable);
	}

	public Page<Webhook> findAll(Pageable pageable) {
		return findAll(null, pageable);
	}

	public Page<WebhookResponse> findAllResponses(@Nullable String search, Pageable pageable) {
		return findAll(search, pageable)
			.map(w -> WebhookResponse.from(w, resolveApplicationName(w), this.encryptionService));
	}

	public Page<WebhookResponse> findAllResponses(Pageable pageable) {
		return findAllResponses(null, pageable);
	}

	@Transactional
	@CacheEvict(cacheNames = "webhooks", allEntries = true)
	public Webhook update(UUID id, EventType eventType, String url, @Nullable String headers,
			@Nullable String bodyTemplate, boolean enabled) {
		Webhook webhook = findById(id);
		String encryptedHeaders = (headers != null) ? this.encryptionService.encrypt(headers) : null;
		webhook.update(eventType, url, encryptedHeaders, bodyTemplate, enabled);
		return this.webhookRepository.save(webhook);
	}

	@Transactional
	@CacheEvict(cacheNames = "webhooks", allEntries = true)
	public void delete(UUID id) {
		Webhook webhook = findById(id);
		this.webhookRepository.delete(webhook);
	}

	public Page<WebhookExecutionResponse> findExecutions(UUID webhookId, Pageable pageable) {
		findById(webhookId);
		return this.executionRepository.findByWebhookIdOrderByExecutedAtDesc(webhookId, pageable)
			.map(WebhookExecutionResponse::from);
	}

	public WebhookResponse toResponse(Webhook webhook) {
		return WebhookResponse.from(webhook, resolveApplicationName(webhook), this.encryptionService);
	}

	@Cacheable(cacheNames = "webhooks", key = "'count'")
	public long count() {
		return this.webhookRepository.count();
	}

	@Nullable private String resolveApplicationName(Webhook webhook) {
		if (webhook.getApplicationId() == null) {
			return null;
		}
		return this.applicationService.findNameById(webhook.getApplicationId());
	}

}
