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

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.micrometer.tracing.test.autoconfigure.AutoConfigureTracing;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(WebhookController.class)
@AutoConfigureTracing
class WebhookControllerTest {

	@Autowired
	MockMvc mockMvc;

	@MockitoBean
	WebhookService webhookService;

	@Test
	@WithMockUser(roles = "ADMIN")
	void should_create_webhook() throws Exception {
		// given
		Webhook webhook = Webhook.create(null, EventType.CONTRACT_PUBLISHED, "https://example.com/hook", null, null);
		given(this.webhookService.create(isNull(), eq(EventType.CONTRACT_PUBLISHED), eq("https://example.com/hook"),
				isNull(), isNull()))
			.willReturn(webhook);
		given(this.webhookService.toResponse(webhook)).willReturn(WebhookResponse.from(webhook, null));

		// when/then
		this.mockMvc
			.perform(post("/api/v1/webhooks").contentType(MediaType.APPLICATION_JSON)
				.content("{\"eventType\":\"CONTRACT_PUBLISHED\",\"url\":\"https://example.com/hook\"}"))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.eventType").value("CONTRACT_PUBLISHED"))
			.andExpect(jsonPath("$.url").value("https://example.com/hook"));
	}

	@Test
	@WithMockUser(roles = "READER")
	void should_list_webhooks() throws Exception {
		// given
		Webhook webhook = Webhook.create(null, EventType.CONTRACT_PUBLISHED, "https://example.com/hook", null, null);
		WebhookResponse response = WebhookResponse.from(webhook, null);
		Page<WebhookResponse> page = new PageImpl<>(List.of(response));
		given(this.webhookService.findAllResponses(any(), any())).willReturn(page);

		// when/then
		this.mockMvc.perform(get("/api/v1/webhooks"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.content[0].url").value("https://example.com/hook"));
	}

	@Test
	@WithMockUser(roles = "READER")
	void should_search_webhooks_by_term() throws Exception {
		// given
		Webhook webhook = Webhook.create(null, EventType.CONTRACT_PUBLISHED, "https://example.com/hook", null, null);
		WebhookResponse response = WebhookResponse.from(webhook, null);
		Page<WebhookResponse> page = new PageImpl<>(List.of(response));
		given(this.webhookService.findAllResponses(eq("example"), any())).willReturn(page);

		// when/then
		this.mockMvc.perform(get("/api/v1/webhooks?search=example"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.content[0].url").value("https://example.com/hook"));
	}

	@Test
	@WithMockUser(roles = "READER")
	void should_get_webhook_by_id() throws Exception {
		// given
		UUID webhookId = UUID.randomUUID();
		Webhook webhook = Webhook.create(null, EventType.CONTRACT_PUBLISHED, "https://example.com/hook", null, null);
		given(this.webhookService.findById(webhookId)).willReturn(webhook);
		given(this.webhookService.toResponse(webhook)).willReturn(WebhookResponse.from(webhook, null));

		// when/then
		this.mockMvc.perform(get("/api/v1/webhooks/{id}", webhookId))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.url").value("https://example.com/hook"));
	}

	@Test
	@WithMockUser(roles = "ADMIN")
	void should_update_webhook() throws Exception {
		// given
		UUID webhookId = UUID.randomUUID();
		Webhook webhook = Webhook.create(null, EventType.DEPLOYMENT_RECORDED, "https://new.com/hook", null, null);
		given(this.webhookService.update(eq(webhookId), eq(EventType.DEPLOYMENT_RECORDED), eq("https://new.com/hook"),
				isNull(), isNull(), eq(true)))
			.willReturn(webhook);
		given(this.webhookService.toResponse(webhook)).willReturn(WebhookResponse.from(webhook, null));

		// when/then
		this.mockMvc
			.perform(put("/api/v1/webhooks/{id}", webhookId).contentType(MediaType.APPLICATION_JSON)
				.content("{\"eventType\":\"DEPLOYMENT_RECORDED\",\"url\":\"https://new.com/hook\",\"enabled\":true}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.eventType").value("DEPLOYMENT_RECORDED"));
	}

	@Test
	@WithMockUser(roles = "ADMIN")
	void should_delete_webhook() throws Exception {
		// given
		UUID webhookId = UUID.randomUUID();

		// when/then
		this.mockMvc.perform(delete("/api/v1/webhooks/{id}", webhookId)).andExpect(status().isNoContent());
		then(this.webhookService).should().delete(webhookId);
	}

	@Test
	@WithMockUser(roles = "READER")
	void should_get_webhook_executions() throws Exception {
		// given
		UUID webhookId = UUID.randomUUID();
		WebhookExecution execution = WebhookExecution.success(webhookId, EventType.CONTRACT_PUBLISHED,
				"https://example.com/hook", "{}", 200, "OK");
		WebhookExecutionResponse execResponse = WebhookExecutionResponse.from(execution);
		Page<WebhookExecutionResponse> page = new PageImpl<>(List.of(execResponse));
		given(this.webhookService.findExecutions(eq(webhookId), any())).willReturn(page);

		// when/then
		this.mockMvc.perform(get("/api/v1/webhooks/{id}/executions", webhookId))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.content[0].success").value(true));
	}

	@Test
	@WithMockUser(roles = "ADMIN")
	void should_return_400_when_enabled_omitted_from_update() throws Exception {
		// given — JSON omits "enabled" field; must not crash with
		// FAIL_ON_NULL_FOR_PRIMITIVES
		UUID webhookId = UUID.randomUUID();

		// when/then — expect 400 validation error, not 500 deserialization crash
		this.mockMvc
			.perform(put("/api/v1/webhooks/{id}", webhookId).contentType(MediaType.APPLICATION_JSON)
				.content("{\"eventType\":\"CONTRACT_PUBLISHED\",\"url\":\"https://example.com/hook\"}"))
			.andExpect(status().isBadRequest());
	}

	@Test
	@WithMockUser(roles = "ADMIN")
	void should_return_400_when_url_missing() throws Exception {
		// when/then
		this.mockMvc
			.perform(post("/api/v1/webhooks").contentType(MediaType.APPLICATION_JSON)
				.content("{\"eventType\":\"CONTRACT_PUBLISHED\"}"))
			.andExpect(status().isBadRequest());
	}

}
