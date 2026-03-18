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
package org.springframework.cloud.contract.broker.webhook;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.jspecify.annotations.Nullable;

@Entity
@Table(name = "webhook_executions")
class WebhookExecution {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(name = "webhook_id", nullable = false)
	private UUID webhookId;

	@Column(name = "event_type", nullable = false, length = 64)
	@Enumerated(EnumType.STRING)
	private EventType eventType;

	@Column(name = "request_url", nullable = false, length = 2048)
	private String requestUrl;

	@Column(name = "request_body")
	@Nullable private String requestBody;

	@Column(name = "response_status")
	@Nullable private Integer responseStatus;

	@Column(name = "response_body")
	@Nullable private String responseBody;

	@Column(nullable = false)
	private boolean success;

	@Column(name = "error_message")
	@Nullable private String errorMessage;

	@Column(name = "executed_at", nullable = false)
	private Instant executedAt;

	protected WebhookExecution() {
	}

	private WebhookExecution(UUID webhookId, EventType eventType, String requestUrl, @Nullable String requestBody,
			@Nullable Integer responseStatus, @Nullable String responseBody, boolean success,
			@Nullable String errorMessage) {
		this.webhookId = webhookId;
		this.eventType = eventType;
		this.requestUrl = requestUrl;
		this.requestBody = requestBody;
		this.responseStatus = responseStatus;
		this.responseBody = responseBody;
		this.success = success;
		this.errorMessage = errorMessage;
		this.executedAt = Instant.now();
	}

	static WebhookExecution success(UUID webhookId, EventType eventType, String requestUrl,
			@Nullable String requestBody, int responseStatus, @Nullable String responseBody) {
		return new WebhookExecution(webhookId, eventType, requestUrl, requestBody, responseStatus, responseBody, true,
				null);
	}

	static WebhookExecution failure(UUID webhookId, EventType eventType, String requestUrl,
			@Nullable String requestBody, @Nullable Integer responseStatus, @Nullable String responseBody,
			String errorMessage) {
		return new WebhookExecution(webhookId, eventType, requestUrl, requestBody, responseStatus, responseBody, false,
				errorMessage);
	}

	UUID getId() {
		return this.id;
	}

	UUID getWebhookId() {
		return this.webhookId;
	}

	EventType getEventType() {
		return this.eventType;
	}

	String getRequestUrl() {
		return this.requestUrl;
	}

	@Nullable String getRequestBody() {
		return this.requestBody;
	}

	@Nullable Integer getResponseStatus() {
		return this.responseStatus;
	}

	@Nullable String getResponseBody() {
		return this.responseBody;
	}

	boolean isSuccess() {
		return this.success;
	}

	@Nullable String getErrorMessage() {
		return this.errorMessage;
	}

	Instant getExecutedAt() {
		return this.executedAt;
	}

}
