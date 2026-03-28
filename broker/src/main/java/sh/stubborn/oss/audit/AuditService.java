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

import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service for recording API-level audit log entries. Uses a separate transaction
 * ({@code REQUIRES_NEW}) so that audit logging does not interfere with the calling
 * transaction.
 *
 * @see AuditInterceptor
 * @see ApiAuditLog
 */
@Service
public class AuditService {

	private static final Logger logger = LoggerFactory.getLogger(AuditService.class);

	private final ApiAuditLogRepository repository;

	AuditService(ApiAuditLogRepository repository) {
		this.repository = repository;
	}

	/**
	 * Persist an audit log entry. Runs in a new transaction so failures do not roll back
	 * the caller.
	 */
	@Transactional(propagation = Propagation.REQUIRES_NEW)
	public void logAction(String principal, AuditAction action, AuditResourceType resourceType,
			@Nullable String resourceId, @Nullable String summary, @Nullable Integer responseStatus,
			@Nullable String ipAddress, @Nullable String traceId) {
		ApiAuditLog entry = ApiAuditLog.create(principal, action, resourceType, resourceId, summary, responseStatus,
				ipAddress, traceId);
		this.repository.save(entry);
		logger.debug("Audit: {} {} {} {} [status={}]", principal, action, resourceType, resourceId, responseStatus);
	}

	Page<ApiAuditLog> findAll(Pageable pageable) {
		return this.repository.findAllByOrderByTimestampDesc(pageable);
	}

	Page<ApiAuditLog> findFiltered(@Nullable String principal, @Nullable AuditAction action,
			@Nullable AuditResourceType resourceType, Pageable pageable) {
		if (principal == null && action == null && resourceType == null) {
			return findAll(pageable);
		}
		return this.repository.findFiltered(principal, action, resourceType, pageable);
	}

}
