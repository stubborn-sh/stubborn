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

import java.net.URI;
import java.util.UUID;

import jakarta.validation.Valid;

import org.jspecify.annotations.Nullable;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/webhooks")
class WebhookController {

	private final WebhookService webhookService;

	WebhookController(WebhookService webhookService) {
		this.webhookService = webhookService;
	}

	@PostMapping
	ResponseEntity<WebhookResponse> create(@Valid @RequestBody CreateWebhookRequest request) {
		Webhook webhook = this.webhookService.create(request.applicationName(), request.eventType(), request.url(),
				request.headers(), request.bodyTemplate());
		WebhookResponse response = this.webhookService.toResponse(webhook);
		URI location = URI.create("/api/v1/webhooks/" + webhook.getId());
		return ResponseEntity.created(location).body(response);
	}

	@GetMapping
	ResponseEntity<Page<WebhookResponse>> list(@RequestParam(required = false) @Nullable String search,
			Pageable pageable) {
		return ResponseEntity.ok(this.webhookService.findAllResponses(search, pageable));
	}

	@GetMapping("/{id}")
	ResponseEntity<WebhookResponse> get(@PathVariable UUID id) {
		Webhook webhook = this.webhookService.findById(id);
		return ResponseEntity.ok(this.webhookService.toResponse(webhook));
	}

	@PutMapping("/{id}")
	ResponseEntity<WebhookResponse> update(@PathVariable UUID id, @Valid @RequestBody UpdateWebhookRequest request) {
		Webhook webhook = this.webhookService.update(id, request.eventType(), request.url(), request.headers(),
				request.bodyTemplate(), request.enabled());
		return ResponseEntity.ok(this.webhookService.toResponse(webhook));
	}

	@DeleteMapping("/{id}")
	ResponseEntity<Void> delete(@PathVariable UUID id) {
		this.webhookService.delete(id);
		return ResponseEntity.noContent().build();
	}

	@GetMapping("/{id}/executions")
	ResponseEntity<Page<WebhookExecutionResponse>> executions(@PathVariable UUID id, Pageable pageable) {
		return ResponseEntity.ok(this.webhookService.findExecutions(id, pageable));
	}

}
