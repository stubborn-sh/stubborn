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

import java.util.Locale;

import org.jspecify.annotations.Nullable;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST controller for querying the API audit log. All endpoints require ADMIN role (see
 * {@code SecurityConfig}).
 *
 * @see AuditService
 * @see AuditResponse
 */
@RestController
@RequestMapping("/api/v1/audit")
class AuditController {

	private final AuditService auditService;

	AuditController(AuditService auditService) {
		this.auditService = auditService;
	}

	@GetMapping
	ResponseEntity<Page<AuditResponse>> list(@Nullable @RequestParam(required = false) String principal,
			@Nullable @RequestParam(required = false) String action,
			@Nullable @RequestParam(required = false) String resourceType, Pageable pageable) {
		AuditAction auditAction = parseAction(action);
		AuditResourceType auditResourceType = parseResourceType(resourceType);
		Page<AuditResponse> page = this.auditService.findFiltered(principal, auditAction, auditResourceType, pageable)
			.map(AuditResponse::from);
		return ResponseEntity.ok(page);
	}

	@Nullable private AuditAction parseAction(@Nullable String action) {
		if (action == null || action.isBlank()) {
			return null;
		}
		return AuditAction.valueOf(action.strip().toUpperCase(Locale.ROOT));
	}

	@Nullable private AuditResourceType parseResourceType(@Nullable String resourceType) {
		if (resourceType == null || resourceType.isBlank()) {
			return null;
		}
		return AuditResourceType.valueOf(resourceType.strip().toUpperCase(Locale.ROOT));
	}

}
