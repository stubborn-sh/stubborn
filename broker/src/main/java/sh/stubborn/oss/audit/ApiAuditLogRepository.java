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

import java.util.UUID;

import org.jspecify.annotations.Nullable;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface ApiAuditLogRepository extends JpaRepository<ApiAuditLog, UUID> {

	Page<ApiAuditLog> findAllByOrderByTimestampDesc(Pageable pageable);

	@Query("""
			SELECT a FROM ApiAuditLog a
			WHERE (:principal IS NULL OR a.principal = :principal)
			AND (:action IS NULL OR a.action = :action)
			AND (:resourceType IS NULL OR a.resourceType = :resourceType)
			ORDER BY a.timestamp DESC
			""")
	Page<ApiAuditLog> findFiltered(@Param("principal") @Nullable String principal,
			@Param("action") @Nullable AuditAction action,
			@Param("resourceType") @Nullable AuditResourceType resourceType, Pageable pageable);

}
