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

import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import sh.stubborn.oss.application.ApplicationService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.lenient;

@ExtendWith(MockitoExtension.class)
class WebhookServiceTest {

	@Mock
	WebhookRepository webhookRepository;

	@Mock
	WebhookExecutionRepository executionRepository;

	@Mock
	ApplicationService applicationService;

	@Mock
	sh.stubborn.oss.security.CredentialEncryptionService encryptionService;

	WebhookService webhookService;

	@BeforeEach
	void setUp() {
		// Passthrough encryption for tests (lenient — not all tests trigger encryption)
		lenient().when(this.encryptionService.encrypt(any())).thenAnswer(inv -> inv.getArgument(0));
		lenient().when(this.encryptionService.decrypt(any())).thenAnswer(inv -> inv.getArgument(0));
		this.webhookService = new WebhookService(this.webhookRepository, this.executionRepository,
				this.applicationService, this.encryptionService);
	}

	@Test
	void should_create_webhook_without_application() {
		// given
		Webhook webhook = Webhook.create(null, EventType.CONTRACT_PUBLISHED, "https://example.com/hook", null, null);
		given(this.webhookRepository.save(any(Webhook.class))).willReturn(webhook);

		// when
		Webhook result = this.webhookService.create(null, EventType.CONTRACT_PUBLISHED, "https://example.com/hook",
				null, null);

		// then
		assertThat(result.getEventType()).isEqualTo(EventType.CONTRACT_PUBLISHED);
		assertThat(result.getUrl()).isEqualTo("https://example.com/hook");
		assertThat(result.getApplicationId()).isNull();
	}

	@Test
	void should_create_webhook_with_application() {
		// given
		UUID appId = UUID.randomUUID();
		given(this.applicationService.findIdByName("order-service")).willReturn(appId);
		Webhook webhook = Webhook.create(appId, EventType.VERIFICATION_PUBLISHED, "https://example.com/hook", null,
				null);
		given(this.webhookRepository.save(any(Webhook.class))).willReturn(webhook);

		// when
		Webhook result = this.webhookService.create("order-service", EventType.VERIFICATION_PUBLISHED,
				"https://example.com/hook", null, null);

		// then
		assertThat(result.getApplicationId()).isEqualTo(appId);
	}

	@Test
	void should_find_webhook_by_id() {
		// given
		UUID webhookId = UUID.randomUUID();
		Webhook webhook = Webhook.create(null, EventType.CONTRACT_PUBLISHED, "https://example.com/hook", null, null);
		given(this.webhookRepository.findById(webhookId)).willReturn(Optional.of(webhook));

		// when
		Webhook result = this.webhookService.findById(webhookId);

		// then
		assertThat(result.getUrl()).isEqualTo("https://example.com/hook");
	}

	@Test
	void should_throw_when_webhook_not_found() {
		// given
		UUID webhookId = UUID.randomUUID();
		given(this.webhookRepository.findById(webhookId)).willReturn(Optional.empty());

		// when/then
		assertThatThrownBy(() -> this.webhookService.findById(webhookId)).isInstanceOf(WebhookNotFoundException.class);
	}

	@Test
	void should_find_all_webhooks_paginated() {
		// given
		Webhook webhook = Webhook.create(null, EventType.CONTRACT_PUBLISHED, "https://example.com/hook", null, null);
		Page<Webhook> page = new PageImpl<>(List.of(webhook));
		given(this.webhookRepository.findAll(PageRequest.of(0, 20))).willReturn(page);

		// when
		Page<Webhook> result = this.webhookService.findAll(PageRequest.of(0, 20));

		// then
		assertThat(result.getTotalElements()).isEqualTo(1);
	}

	@Test
	void should_search_webhooks_by_term() {
		// given
		Webhook webhook = Webhook.create(null, EventType.CONTRACT_PUBLISHED, "https://example.com/hook", null, null);
		Page<Webhook> page = new PageImpl<>(List.of(webhook));
		given(this.webhookRepository.searchByEventTypeOrUrl(eq("example"), any(PageRequest.class))).willReturn(page);

		// when
		Page<Webhook> result = this.webhookService.findAll("example", PageRequest.of(0, 20));

		// then
		assertThat(result.getTotalElements()).isEqualTo(1);
		then(this.webhookRepository).should().searchByEventTypeOrUrl(eq("example"), any(PageRequest.class));
	}

	@Test
	void should_find_all_webhooks_when_search_blank() {
		// given
		Webhook webhook = Webhook.create(null, EventType.CONTRACT_PUBLISHED, "https://example.com/hook", null, null);
		Page<Webhook> page = new PageImpl<>(List.of(webhook));
		given(this.webhookRepository.findAll(any(PageRequest.class))).willReturn(page);

		// when
		Page<Webhook> result = this.webhookService.findAll("  ", PageRequest.of(0, 20));

		// then
		assertThat(result.getTotalElements()).isEqualTo(1);
		then(this.webhookRepository).should().findAll(any(PageRequest.class));
	}

	@Test
	void should_update_webhook() {
		// given
		UUID webhookId = UUID.randomUUID();
		Webhook webhook = Webhook.create(null, EventType.CONTRACT_PUBLISHED, "https://old.com/hook", null, null);
		given(this.webhookRepository.findById(webhookId)).willReturn(Optional.of(webhook));
		given(this.webhookRepository.save(any(Webhook.class))).willReturn(webhook);

		// when
		Webhook result = this.webhookService.update(webhookId, EventType.DEPLOYMENT_RECORDED, "https://new.com/hook",
				null, null, false);

		// then
		assertThat(result.getEventType()).isEqualTo(EventType.DEPLOYMENT_RECORDED);
		assertThat(result.getUrl()).isEqualTo("https://new.com/hook");
		assertThat(result.isEnabled()).isFalse();
	}

	@Test
	void should_delete_webhook() {
		// given
		UUID webhookId = UUID.randomUUID();
		Webhook webhook = Webhook.create(null, EventType.CONTRACT_PUBLISHED, "https://example.com/hook", null, null);
		given(this.webhookRepository.findById(webhookId)).willReturn(Optional.of(webhook));

		// when
		this.webhookService.delete(webhookId);

		// then
		then(this.webhookRepository).should().delete(webhook);
	}

	@Test
	void should_find_executions_for_webhook() {
		// given
		UUID webhookId = UUID.randomUUID();
		Webhook webhook = Webhook.create(null, EventType.CONTRACT_PUBLISHED, "https://example.com/hook", null, null);
		given(this.webhookRepository.findById(webhookId)).willReturn(Optional.of(webhook));
		WebhookExecution execution = WebhookExecution.success(webhookId, EventType.CONTRACT_PUBLISHED,
				"https://example.com/hook", "{}", 200, "OK");
		Page<WebhookExecution> page = new PageImpl<>(List.of(execution));
		given(this.executionRepository.findByWebhookIdOrderByExecutedAtDesc(webhookId, PageRequest.of(0, 20)))
			.willReturn(page);

		// when
		Page<WebhookExecutionResponse> result = this.webhookService.findExecutions(webhookId, PageRequest.of(0, 20));

		// then
		assertThat(result.getTotalElements()).isEqualTo(1);
		assertThat(result.getContent().get(0).success()).isTrue();
	}

	@Test
	void should_count_webhooks() {
		// given
		given(this.webhookRepository.count()).willReturn(5L);

		// when
		long count = this.webhookService.count();

		// then
		assertThat(count).isEqualTo(5L);
	}

}
