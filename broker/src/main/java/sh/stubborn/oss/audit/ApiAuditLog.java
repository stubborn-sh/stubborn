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
package sh.stubborn.oss.audit;

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

/**
 * JPA entity for the {@code api_audit_log} table. Each row records a single mutating API
 * action (POST/PUT/DELETE) with the authenticated principal and outcome.
 *
 * @see AuditService
 * @see AuditInterceptor
 */
@Entity
@Table(name = "api_audit_log")
class ApiAuditLog {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(nullable = false)
	private Instant timestamp;

	@Column(nullable = false, length = 255)
	private String principal;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private AuditAction action;

	@Enumerated(EnumType.STRING)
	@Column(name = "resource_type", nullable = false, length = 64)
	private AuditResourceType resourceType;

	@Column(name = "resource_id", length = 255)
	@Nullable private String resourceId;

	@Column(name = "request_summary", columnDefinition = "TEXT")
	@Nullable private String requestSummary;

	@Column(name = "response_status")
	@Nullable private Integer responseStatus;

	@Column(name = "ip_address", length = 45)
	@Nullable private String ipAddress;

	@Column(name = "trace_id", length = 64)
	@Nullable private String traceId;

	protected ApiAuditLog() {
	}

	private ApiAuditLog(String principal, AuditAction action, AuditResourceType resourceType,
			@Nullable String resourceId, @Nullable String requestSummary, @Nullable Integer responseStatus,
			@Nullable String ipAddress, @Nullable String traceId) {
		this.timestamp = Instant.now();
		this.principal = principal;
		this.action = action;
		this.resourceType = resourceType;
		this.resourceId = resourceId;
		this.requestSummary = requestSummary;
		this.responseStatus = responseStatus;
		this.ipAddress = ipAddress;
		this.traceId = traceId;
	}

	static ApiAuditLog create(String principal, AuditAction action, AuditResourceType resourceType,
			@Nullable String resourceId, @Nullable String requestSummary, @Nullable Integer responseStatus,
			@Nullable String ipAddress, @Nullable String traceId) {
		return new ApiAuditLog(principal, action, resourceType, resourceId, requestSummary, responseStatus, ipAddress,
				traceId);
	}

	UUID getId() {
		return this.id;
	}

	Instant getTimestamp() {
		return this.timestamp;
	}

	String getPrincipal() {
		return this.principal;
	}

	AuditAction getAction() {
		return this.action;
	}

	AuditResourceType getResourceType() {
		return this.resourceType;
	}

	@Nullable String getResourceId() {
		return this.resourceId;
	}

	@Nullable String getRequestSummary() {
		return this.requestSummary;
	}

	@Nullable Integer getResponseStatus() {
		return this.responseStatus;
	}

	@Nullable String getIpAddress() {
		return this.ipAddress;
	}

	@Nullable String getTraceId() {
		return this.traceId;
	}

}
