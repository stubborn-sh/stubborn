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
package sh.stubborn.broker.webhook;

import java.util.UUID;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class WebhookEntityTest {

	@Test
	void should_create_webhook_with_all_fields_when_application_provided() {
		// given
		UUID applicationId = UUID.randomUUID();
		String headers = "{\"Authorization\":\"Bearer token\"}";
		String bodyTemplate = "{\"event\": \"{{eventType}}\"}";

		// when
		Webhook webhook = Webhook.create(applicationId, EventType.CONTRACT_PUBLISHED, "https://example.com/hook",
				headers, bodyTemplate);

		// then
		assertThat(webhook.getId()).isNull();
		assertThat(webhook.getApplicationId()).isEqualTo(applicationId);
		assertThat(webhook.getEventType()).isEqualTo(EventType.CONTRACT_PUBLISHED);
		assertThat(webhook.getUrl()).isEqualTo("https://example.com/hook");
		assertThat(webhook.getHeaders()).isEqualTo(headers);
		assertThat(webhook.getBodyTemplate()).isEqualTo(bodyTemplate);
		assertThat(webhook.isEnabled()).isTrue();
		assertThat(webhook.getCreatedAt()).isNotNull();
		assertThat(webhook.getUpdatedAt()).isNotNull();
	}

	@Test
	void should_create_webhook_with_nullable_fields_when_no_application() {
		// when
		Webhook webhook = Webhook.create(null, EventType.VERIFICATION_FAILED, "https://hooks.example.com/notify", null,
				null);

		// then
		assertThat(webhook.getApplicationId()).isNull();
		assertThat(webhook.getEventType()).isEqualTo(EventType.VERIFICATION_FAILED);
		assertThat(webhook.getUrl()).isEqualTo("https://hooks.example.com/notify");
		assertThat(webhook.getHeaders()).isNull();
		assertThat(webhook.getBodyTemplate()).isNull();
		assertThat(webhook.isEnabled()).isTrue();
		assertThat(webhook.getCreatedAt()).isNotNull();
		assertThat(webhook.getUpdatedAt()).isNotNull();
	}

	@Test
	void should_update_webhook_fields_when_update_called() {
		// given
		Webhook webhook = Webhook.create(null, EventType.CONTRACT_PUBLISHED, "https://old.com/hook", null, null);

		// when
		webhook.update(EventType.DEPLOYMENT_RECORDED, "https://new.com/hook", "{\"X-Custom\":\"val\"}",
				"{\"deploy\": true}", false);

		// then
		assertThat(webhook.getEventType()).isEqualTo(EventType.DEPLOYMENT_RECORDED);
		assertThat(webhook.getUrl()).isEqualTo("https://new.com/hook");
		assertThat(webhook.getHeaders()).isEqualTo("{\"X-Custom\":\"val\"}");
		assertThat(webhook.getBodyTemplate()).isEqualTo("{\"deploy\": true}");
		assertThat(webhook.isEnabled()).isFalse();
		assertThat(webhook.getUpdatedAt()).isNotNull();
	}

	@Test
	void should_return_empty_map_when_headers_null() {
		// given
		Webhook webhook = Webhook.create(null, EventType.CONTRACT_PUBLISHED, "https://example.com/hook", null, null);

		// when/then
		assertThat(webhook.getHeadersAsMap()).isEmpty();
	}

	@Test
	void should_parse_headers_as_map_when_headers_present() {
		// given
		Webhook webhook = Webhook.create(null, EventType.CONTRACT_PUBLISHED, "https://example.com/hook",
				"{\"Content-Type\":\"application/json\"}", null);

		// when/then
		assertThat(webhook.getHeadersAsMap()).containsEntry("Content-Type", "application/json");
	}

	@Test
	void should_create_successful_execution_with_all_fields() {
		// given
		UUID webhookId = UUID.randomUUID();
		String requestBody = "{\"event\":\"CONTRACT_PUBLISHED\"}";
		String responseBody = "{\"status\":\"received\"}";

		// when
		WebhookExecution execution = WebhookExecution.success(webhookId, EventType.CONTRACT_PUBLISHED,
				"https://example.com/hook", requestBody, 200, responseBody);

		// then
		assertThat(execution.getId()).isNull();
		assertThat(execution.getWebhookId()).isEqualTo(webhookId);
		assertThat(execution.getEventType()).isEqualTo(EventType.CONTRACT_PUBLISHED);
		assertThat(execution.getRequestUrl()).isEqualTo("https://example.com/hook");
		assertThat(execution.getRequestBody()).isEqualTo(requestBody);
		assertThat(execution.getResponseStatus()).isEqualTo(200);
		assertThat(execution.getResponseBody()).isEqualTo(responseBody);
		assertThat(execution.isSuccess()).isTrue();
		assertThat(execution.getErrorMessage()).isNull();
		assertThat(execution.getExecutedAt()).isNotNull();
	}

	@Test
	void should_create_failed_execution_with_error_message() {
		// given
		UUID webhookId = UUID.randomUUID();
		String requestBody = "{\"event\":\"DEPLOYMENT_RECORDED\"}";

		// when
		WebhookExecution execution = WebhookExecution.failure(webhookId, EventType.DEPLOYMENT_RECORDED,
				"https://example.com/hook", requestBody, 500, "Internal Server Error", "Connection refused");

		// then
		assertThat(execution.getId()).isNull();
		assertThat(execution.getWebhookId()).isEqualTo(webhookId);
		assertThat(execution.getEventType()).isEqualTo(EventType.DEPLOYMENT_RECORDED);
		assertThat(execution.getRequestUrl()).isEqualTo("https://example.com/hook");
		assertThat(execution.getRequestBody()).isEqualTo(requestBody);
		assertThat(execution.getResponseStatus()).isEqualTo(500);
		assertThat(execution.getResponseBody()).isEqualTo("Internal Server Error");
		assertThat(execution.isSuccess()).isFalse();
		assertThat(execution.getErrorMessage()).isEqualTo("Connection refused");
		assertThat(execution.getExecutedAt()).isNotNull();
	}

	@Test
	void should_create_failed_execution_with_null_response_when_timeout() {
		// given
		UUID webhookId = UUID.randomUUID();

		// when
		WebhookExecution execution = WebhookExecution.failure(webhookId, EventType.VERIFICATION_PUBLISHED,
				"https://example.com/hook", null, null, null, "Read timed out");

		// then
		assertThat(execution.getRequestBody()).isNull();
		assertThat(execution.getResponseStatus()).isNull();
		assertThat(execution.getResponseBody()).isNull();
		assertThat(execution.isSuccess()).isFalse();
		assertThat(execution.getErrorMessage()).isEqualTo("Read timed out");
	}

	@Test
	void should_map_webhook_to_response_with_application_name() {
		// given
		UUID applicationId = UUID.randomUUID();
		String headers = "{\"X-Token\":\"secret\"}";
		String bodyTemplate = "{\"msg\": \"hello\"}";
		Webhook webhook = Webhook.create(applicationId, EventType.VERIFICATION_SUCCEEDED,
				"https://hooks.example.com/notify", headers, bodyTemplate);

		// when
		WebhookResponse response = WebhookResponse.from(webhook, "order-service");

		// then
		assertThat(response.id()).isNull();
		assertThat(response.applicationId()).isEqualTo(applicationId);
		assertThat(response.applicationName()).isEqualTo("order-service");
		assertThat(response.eventType()).isEqualTo(EventType.VERIFICATION_SUCCEEDED);
		assertThat(response.url()).isEqualTo("https://hooks.example.com/notify");
		assertThat(response.headers()).isEqualTo(headers);
		assertThat(response.bodyTemplate()).isEqualTo(bodyTemplate);
		assertThat(response.enabled()).isTrue();
		assertThat(response.createdAt()).isNotNull();
		assertThat(response.updatedAt()).isNotNull();
	}

	@Test
	void should_map_webhook_to_response_with_null_application_name() {
		// given
		Webhook webhook = Webhook.create(null, EventType.CONTRACT_PUBLISHED, "https://example.com/hook", null, null);

		// when
		WebhookResponse response = WebhookResponse.from(webhook, null);

		// then
		assertThat(response.applicationId()).isNull();
		assertThat(response.applicationName()).isNull();
		assertThat(response.headers()).isNull();
		assertThat(response.bodyTemplate()).isNull();
		assertThat(response.enabled()).isTrue();
	}

	@Test
	void should_map_successful_execution_to_response() {
		// given
		UUID webhookId = UUID.randomUUID();
		String requestBody = "{\"contract\":\"new\"}";
		String responseBody = "{\"ok\":true}";
		WebhookExecution execution = WebhookExecution.success(webhookId, EventType.CONTRACT_PUBLISHED,
				"https://example.com/hook", requestBody, 200, responseBody);

		// when
		WebhookExecutionResponse response = WebhookExecutionResponse.from(execution);

		// then
		assertThat(response.id()).isNull();
		assertThat(response.webhookId()).isEqualTo(webhookId);
		assertThat(response.eventType()).isEqualTo(EventType.CONTRACT_PUBLISHED);
		assertThat(response.requestUrl()).isEqualTo("https://example.com/hook");
		assertThat(response.requestBody()).isEqualTo(requestBody);
		assertThat(response.responseStatus()).isEqualTo(200);
		assertThat(response.responseBody()).isEqualTo(responseBody);
		assertThat(response.success()).isTrue();
		assertThat(response.errorMessage()).isNull();
		assertThat(response.executedAt()).isNotNull();
	}

	@Test
	void should_map_failed_execution_to_response() {
		// given
		UUID webhookId = UUID.randomUUID();
		WebhookExecution execution = WebhookExecution.failure(webhookId, EventType.DEPLOYMENT_RECORDED,
				"https://example.com/hook", "{\"deploy\":true}", 503, "Service Unavailable", "Upstream error");

		// when
		WebhookExecutionResponse response = WebhookExecutionResponse.from(execution);

		// then
		assertThat(response.id()).isNull();
		assertThat(response.webhookId()).isEqualTo(webhookId);
		assertThat(response.eventType()).isEqualTo(EventType.DEPLOYMENT_RECORDED);
		assertThat(response.requestUrl()).isEqualTo("https://example.com/hook");
		assertThat(response.requestBody()).isEqualTo("{\"deploy\":true}");
		assertThat(response.responseStatus()).isEqualTo(503);
		assertThat(response.responseBody()).isEqualTo("Service Unavailable");
		assertThat(response.success()).isFalse();
		assertThat(response.errorMessage()).isEqualTo("Upstream error");
		assertThat(response.executedAt()).isNotNull();
	}

}
