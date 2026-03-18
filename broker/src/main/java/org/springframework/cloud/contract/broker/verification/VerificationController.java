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
package org.springframework.cloud.contract.broker.verification;

import java.net.URI;
import java.util.UUID;

import jakarta.validation.Valid;

import org.jspecify.annotations.Nullable;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/verifications")
class VerificationController {

	private final VerificationService verificationService;

	VerificationController(VerificationService verificationService) {
		this.verificationService = verificationService;
	}

	@PostMapping
	ResponseEntity<VerificationResponse> record(@Valid @RequestBody CreateVerificationRequest request) {
		Verification verification = this.verificationService.record(request.providerName(), request.providerVersion(),
				request.consumerName(), request.consumerVersion(), request.status(), request.details(),
				request.branch());
		VerificationResponse response = VerificationResponse.from(verification, request.providerName(),
				request.consumerName());
		URI location = URI.create("/api/v1/verifications/" + verification.getId());
		return ResponseEntity.created(location).body(response);
	}

	@GetMapping
	ResponseEntity<Page<VerificationResponse>> list(@RequestParam(required = false) @Nullable String provider,
			@RequestParam(required = false) @Nullable String providerVersion,
			@RequestParam(required = false) @Nullable String search, Pageable pageable) {
		Page<VerificationResponse> page;
		if (provider != null && providerVersion != null) {
			page = this.verificationService.findByProviderAndVersion(provider, providerVersion, pageable)
				.map(this::toResponse);
		}
		else {
			page = this.verificationService.findAll(search, pageable).map(this::toResponse);
		}
		return ResponseEntity.ok(page);
	}

	@GetMapping("/{id}")
	ResponseEntity<VerificationResponse> getById(@PathVariable UUID id) {
		Verification verification = this.verificationService.findById(id);
		return ResponseEntity.ok(toResponse(verification));
	}

	private VerificationResponse toResponse(Verification verification) {
		String providerName = this.verificationService.resolveApplicationName(verification.getProviderId());
		String consumerName = this.verificationService.resolveApplicationName(verification.getConsumerId());
		return VerificationResponse.from(verification, providerName, consumerName);
	}

}
