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
import java.util.Map;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.jspecify.annotations.Nullable;

import org.springframework.boot.json.JacksonJsonParser;

@Entity
@Table(name = "webhooks")
class Webhook {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(name = "application_id")
	@Nullable private UUID applicationId;

	@Column(name = "event_type", nullable = false, length = 64)
	@Enumerated(EnumType.STRING)
	private EventType eventType;

	@Column(nullable = false, length = 2048)
	private String url;

	@Column(columnDefinition = "JSONB")
	@JdbcTypeCode(SqlTypes.JSON)
	@Nullable private String headers;

	@Column(name = "body_template")
	@Nullable private String bodyTemplate;

	@Column(nullable = false)
	private boolean enabled;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	@Version
	@Column(name = "row_version")
	private Long rowVersion;

	protected Webhook() {
	}

	private Webhook(@Nullable UUID applicationId, EventType eventType, String url, @Nullable String headers,
			@Nullable String bodyTemplate) {
		this.applicationId = applicationId;
		this.eventType = eventType;
		this.url = url;
		this.headers = headers;
		this.bodyTemplate = bodyTemplate;
		this.enabled = true;
		this.createdAt = Instant.now();
		this.updatedAt = Instant.now();
	}

	static Webhook create(@Nullable UUID applicationId, EventType eventType, String url, @Nullable String headers,
			@Nullable String bodyTemplate) {
		return new Webhook(applicationId, eventType, url, headers, bodyTemplate);
	}

	void update(EventType eventType, String url, @Nullable String headers, @Nullable String bodyTemplate,
			boolean enabled) {
		this.eventType = eventType;
		this.url = url;
		this.headers = headers;
		this.bodyTemplate = bodyTemplate;
		this.enabled = enabled;
		this.updatedAt = Instant.now();
	}

	UUID getId() {
		return this.id;
	}

	@Nullable UUID getApplicationId() {
		return this.applicationId;
	}

	EventType getEventType() {
		return this.eventType;
	}

	String getUrl() {
		return this.url;
	}

	@Nullable String getHeaders() {
		return this.headers;
	}

	Map<String, Object> getHeadersAsMap() {
		if (this.headers == null) {
			return Map.of();
		}
		return new JacksonJsonParser().parseMap(this.headers);
	}

	@Nullable String getBodyTemplate() {
		return this.bodyTemplate;
	}

	boolean isEnabled() {
		return this.enabled;
	}

	Instant getCreatedAt() {
		return this.createdAt;
	}

	Instant getUpdatedAt() {
		return this.updatedAt;
	}

}
