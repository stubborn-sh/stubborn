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

import org.jspecify.annotations.Nullable;

record WebhookExecutionResponse(UUID id, UUID webhookId, EventType eventType, String requestUrl,
		@Nullable String requestBody, @Nullable Integer responseStatus, @Nullable String responseBody, boolean success,
		@Nullable String errorMessage, Instant executedAt) {

	static WebhookExecutionResponse from(WebhookExecution execution) {
		return new WebhookExecutionResponse(execution.getId(), execution.getWebhookId(), execution.getEventType(),
				execution.getRequestUrl(), execution.getRequestBody(), execution.getResponseStatus(),
				execution.getResponseBody(), execution.isSuccess(), execution.getErrorMessage(),
				execution.getExecutedAt());
	}

}
