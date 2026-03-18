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
import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.micrometer.tracing.test.autoconfigure.AutoConfigureTracing;
import org.springframework.boot.restdocs.test.autoconfigure.AutoConfigureRestDocs;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.restdocs.mockmvc.RestDocumentationResultHandler;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.BDDMockito.given;
import static org.springframework.cloud.contract.wiremock.restdocs.SpringCloudContractRestDocs.dslContract;
import static org.springframework.restdocs.mockmvc.MockMvcRestDocumentation.document;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Tag("generate-stubs")
@WebMvcTest(WebhookController.class)
@AutoConfigureTracing
@AutoConfigureRestDocs
@WithMockUser(roles = "ADMIN")
class WebhookContractTest {

	@Autowired
	MockMvc mockMvc;

	@MockitoBean
	WebhookService webhookService;

	@Test
	void should_create_webhook() throws Exception {
		// given
		UUID id = UUID.fromString("33333333-3333-3333-3333-333333333333");
		var webhook = stubWebhook(id, "webhook-app", EventType.CONTRACT_PUBLISHED,
				"https://hooks.example.com/contracts", true);
		given(this.webhookService.create(eq("webhook-app"), eq(EventType.CONTRACT_PUBLISHED),
				eq("https://hooks.example.com/contracts"), isNull(), isNull()))
			.willReturn(webhook);
		given(this.webhookService.toResponse(webhook)).willReturn(toResponse(id, webhook, "webhook-app"));

		// when/then
		this.mockMvc
			.perform(post("/api/v1/webhooks").with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content(
						"""
								{"applicationName":"webhook-app","eventType":"CONTRACT_PUBLISHED","url":"https://hooks.example.com/contracts"}
								"""))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.id").value(id.toString()))
			.andExpect(jsonPath("$.eventType").value("CONTRACT_PUBLISHED"))
			.andExpect(jsonPath("$.url").value("https://hooks.example.com/contracts"))
			.andDo(contractDocument("create-webhook"));
	}

	@Test
	void should_list_webhooks() throws Exception {
		// given
		UUID id = UUID.fromString("44444444-4444-4444-4444-444444444444");
		var webhook = stubWebhook(id, null, EventType.VERIFICATION_FAILED, "https://hooks.example.com/failures", true);
		var response = toResponse(id, webhook, null);
		given(this.webhookService.findAllResponses(any(), any(Pageable.class)))
			.willReturn(new PageImpl<>(List.of(response)));

		// when/then
		this.mockMvc.perform(get("/api/v1/webhooks"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.content[0].eventType").value("VERIFICATION_FAILED"))
			.andExpect(jsonPath("$.content[0].url").value("https://hooks.example.com/failures"))
			.andDo(contractDocument("list-webhooks"));
	}

	@Test
	void should_get_webhook_by_id() throws Exception {
		// given
		UUID id = UUID.fromString("55555555-5555-5555-5555-555555555555");
		var webhook = stubWebhook(id, null, EventType.DEPLOYMENT_RECORDED, "https://hooks.example.com/deployments",
				true);
		given(this.webhookService.findById(id)).willReturn(webhook);
		given(this.webhookService.toResponse(webhook)).willReturn(toResponse(id, webhook, null));

		// when/then
		this.mockMvc.perform(get("/api/v1/webhooks/{id}", id))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.id").value(id.toString()))
			.andExpect(jsonPath("$.eventType").value("DEPLOYMENT_RECORDED"))
			.andDo(contractDocument("get-webhook"));
	}

	@Test
	void should_delete_webhook() throws Exception {
		// given
		UUID id = UUID.fromString("66666666-6666-6666-6666-666666666666");
		var webhook = stubWebhook(id, null, EventType.CONTRACT_PUBLISHED, "https://hooks.example.com/x", true);
		given(this.webhookService.findById(id)).willReturn(webhook);

		// when/then
		this.mockMvc.perform(delete("/api/v1/webhooks/{id}", id).with(csrf()))
			.andExpect(status().isNoContent())
			.andDo(contractDocument("delete-webhook"));
	}

	private static Webhook stubWebhook(UUID id, @Nullable String applicationName, EventType eventType, String url,
			boolean enabled) {
		return Webhook.create(applicationName != null ? UUID.randomUUID() : null, eventType, url, null, null);
	}

	private static WebhookResponse toResponse(UUID id, Webhook webhook, @Nullable String applicationName) {
		return new WebhookResponse(id, webhook.getApplicationId(), applicationName, webhook.getEventType(),
				webhook.getUrl(), webhook.getHeaders(), webhook.getBodyTemplate(), webhook.isEnabled(),
				Instant.parse("2026-02-20T10:00:00Z"), Instant.parse("2026-02-20T10:00:00Z"));
	}

	private static RestDocumentationResultHandler contractDocument(String identifier) {
		return document(identifier, dslContract());
	}

}
