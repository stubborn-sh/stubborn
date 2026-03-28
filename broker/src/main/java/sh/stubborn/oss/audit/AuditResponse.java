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

import org.jspecify.annotations.Nullable;

/**
 * Response DTO for API audit log entries.
 *
 * @see AuditController
 */
record AuditResponse(UUID id, Instant timestamp, String principal, String action, String resourceType,
		@Nullable String resourceId, @Nullable String requestSummary, @Nullable Integer responseStatus,
		@Nullable String ipAddress, @Nullable String traceId) {

	static AuditResponse from(ApiAuditLog entry) {
		return new AuditResponse(entry.getId(), entry.getTimestamp(), entry.getPrincipal(), entry.getAction().name(),
				entry.getResourceType().name(), entry.getResourceId(), entry.getRequestSummary(),
				entry.getResponseStatus(), entry.getIpAddress(), entry.getTraceId());
	}

}
