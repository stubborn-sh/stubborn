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
package sh.stubborn.broker.maintenance;

import jakarta.validation.Valid;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/maintenance")
@ConditionalOnProperty(name = "broker.pro.enabled", havingValue = "true", matchIfMissing = true)
class CleanupController {

	private final CleanupService cleanupService;

	CleanupController(CleanupService cleanupService) {
		this.cleanupService = cleanupService;
	}

	@PostMapping("/cleanup")
	ResponseEntity<CleanupResult> cleanup(@Valid @RequestBody CleanupRequest request) {
		CleanupResult result = this.cleanupService.cleanup(request.applicationName(), request.keepLatestVersions(),
				request.protectedEnvironments());
		return ResponseEntity.ok(result);
	}

}
