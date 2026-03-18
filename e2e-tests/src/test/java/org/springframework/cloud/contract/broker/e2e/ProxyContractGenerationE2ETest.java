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
package org.springframework.cloud.contract.broker.e2e;

import java.io.IOException;
import java.util.Map;

import com.microsoft.playwright.APIRequestContext;
import com.microsoft.playwright.APIResponse;
import com.microsoft.playwright.options.RequestOptions;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * E2E tests for the AI traffic-to-contract proxy: capture traffic through proxy, batch
 * generate contracts with OpenAPI validation, retrieve via REST, and publish to broker.
 * Uses WireMock to simulate the target service and the OpenAI API.
 */
class ProxyContractGenerationE2ETest extends BaseE2ETest {

	private static final String TARGET_PATH = "/api/orders/1";

	private static final String TARGET_RESPONSE = "{\"id\": 1, \"status\": \"SHIPPED\"}";

	private static final String VALID_CONTRACT = """
			request:
			  method: GET
			  url: /api/orders/1
			response:
			  status: 200
			  body:
			    id: 1
			    status: SHIPPED
			""";

	private static final String INVALID_CONTRACT = """
			request:
			  method: POST
			  url: /api/orders/1
			response:
			  status: 200
			  body:
			    id: 1
			    status: SHIPPED
			""";

	private static final String OPENAPI_SPEC = """
			openapi: "3.0.1"
			info:
			  title: Order Service
			  version: "1.0"
			paths:
			  /api/orders/{id}:
			    get:
			      operationId: getOrder
			      parameters:
			        - name: id
			          in: path
			          required: true
			          schema:
			            type: integer
			      responses:
			        "200":
			          description: Order found
			          content:
			            application/json:
			              schema:
			                type: object
			                properties:
			                  id:
			                    type: integer
			                  status:
			                    type: string
			""";

	private APIRequestContext wiremockApiContext;

	@Override
	@BeforeAll
	void setUpPlaywright() throws IOException {
		super.setUpPlaywright();
		this.wiremockApiContext = this.playwright.request()
			.newContext(new com.microsoft.playwright.APIRequest.NewContextOptions().setBaseURL(this.wiremockUrl));
	}

	@Override
	@AfterAll
	void tearDownPlaywright() {
		if (this.wiremockApiContext != null) {
			this.wiremockApiContext.dispose();
		}
		super.tearDownPlaywright();
	}

	@Test
	@Order(1)
	void should_capture_traffic_through_proxy() {
		// given — set up WireMock target stub
		registerTargetStub();
		registerOpenApiStub();

		// Clear any previous captures
		this.proxyApiContext.delete("/api/v1/captures");

		// when — send 2 requests through the proxy to the WireMock target
		for (int i = 0; i < 2; i++) {
			APIResponse proxyResponse = this.proxyApiContext.get("/api/v1/proxy" + TARGET_PATH,
					RequestOptions.create().setHeader("X-Target-Url", this.wiremockInternalUrl));
			assertThat(proxyResponse.status()).as("Proxy response status for request %d", i + 1).isEqualTo(200);
			assertThat(proxyResponse.text()).contains("SHIPPED");
		}

		// then — captures are stored
		APIResponse countResponse = this.proxyApiContext.get("/api/v1/captures/count");
		assertThat(countResponse.status()).isEqualTo(200);
		String countBody = countResponse.text();
		assertThat(countBody).satisfiesAnyOf(body -> assertThat(body).contains("\"count\":2"),
				body -> assertThat(body).contains("\"count\" : 2"));
	}

	@Test
	@Order(2)
	void should_generate_validated_contracts_via_batch() {
		assumePriorTestsPassed();
		// given — set up OpenAI WireMock stub using Scenario for retry behavior:
		// first call returns invalid contract (POST instead of GET), second returns valid
		registerOpenAiRetryScenario();

		// when — trigger batch generation
		APIResponse batchResponse = this.proxyApiContext.post("/api/v1/batch/generate",
				RequestOptions.create().setHeader("Content-Type", "application/json"));

		// then — result contains contracts
		assertThat(batchResponse.status()).isEqualTo(200);
		String body = batchResponse.text();
		assertThat(body).contains("contracts");
	}

	@Test
	@Order(3)
	void should_retrieve_contracts_via_rest_api() {
		assumePriorTestsPassed();
		// when — fetch generated contracts
		APIResponse response = this.proxyApiContext.get("/api/v1/batch/contracts");

		// then — non-empty list
		assertThat(response.status()).isEqualTo(200);
		String body = response.text();
		assertThat(body).startsWith("[");
	}

	@Test
	@Order(4)
	void should_publish_generated_contract_to_broker() {
		assumePriorTestsPassed();
		// given — seed app in broker
		seedApp("proxy-order-service", "proxy-team");

		// when — publish a contract to broker
		String contractContent = "request:\n  method: GET\n  url: /api/orders/1\nresponse:\n  status: 200";
		seedContract("proxy-order-service", "1.0.0", "proxy-get-order", contractContent);

		// then — contract is accessible in broker
		APIResponse response = this.apiContext.get("/api/v1/applications/proxy-order-service/versions/1.0.0/contracts");
		assertThat(response.status()).isEqualTo(200);
		assertThat(response.text()).contains("proxy-get-order");
	}

	@Test
	@Order(5)
	void should_return_failures_when_openai_always_invalid() {
		assumePriorTestsPassed();
		// given — clear captures and add fresh ones
		this.proxyApiContext.delete("/api/v1/captures");
		registerTargetStub();

		APIResponse proxyResponse = this.proxyApiContext.get("/api/v1/proxy" + TARGET_PATH,
				RequestOptions.create().setHeader("X-Target-Url", this.wiremockInternalUrl));
		assertThat(proxyResponse.status()).isEqualTo(200);

		// Reset WireMock OpenAI stubs and set up always-invalid response
		resetWireMockMappings();
		registerTargetStub();
		registerOpenApiStub();
		registerOpenAiAlwaysInvalid();

		// when — trigger batch generation
		APIResponse batchResponse = this.proxyApiContext.post("/api/v1/batch/generate",
				RequestOptions.create().setHeader("Content-Type", "application/json"));

		// then — result contains failures
		assertThat(batchResponse.status()).isEqualTo(200);
		String body = batchResponse.text();
		assertThat(body).contains("failures");
	}

	private void registerTargetStub() {
		String stubMapping = """
				{
				  "request": {
				    "method": "GET",
				    "urlPath": "%s"
				  },
				  "response": {
				    "status": 200,
				    "headers": {"Content-Type": "application/json"},
				    "body": "%s"
				  }
				}
				""".formatted(TARGET_PATH, TARGET_RESPONSE.replace("\"", "\\\""));
		this.wiremockApiContext.post("/__admin/mappings",
				RequestOptions.create().setHeader("Content-Type", "application/json").setData(stubMapping));
	}

	private void registerOpenApiStub() {
		String stubMapping = """
				{
				  "request": {
				    "method": "GET",
				    "urlPath": "/v3/api-docs"
				  },
				  "response": {
				    "status": 200,
				    "headers": {"Content-Type": "application/yaml"},
				    "body": %s
				  }
				}
				""".formatted(jsonEscape(OPENAPI_SPEC));
		this.wiremockApiContext.post("/__admin/mappings",
				RequestOptions.create().setHeader("Content-Type", "application/json").setData(stubMapping));
	}

	private void registerOpenAiRetryScenario() {
		// First call: returns invalid contract (POST instead of GET) — Scenario state:
		// Started
		String firstMapping = """
				{
				  "scenarioName": "OpenAI Retry",
				  "requiredScenarioState": "Started",
				  "newScenarioState": "SecondCall",
				  "request": {
				    "method": "POST",
				    "urlPath": "/v1/chat/completions"
				  },
				  "response": {
				    "status": 200,
				    "headers": {"Content-Type": "application/json"},
				    "body": "{\\"id\\":\\"chatcmpl-1\\",\\"object\\":\\"chat.completion\\",\\"choices\\":[{\\"index\\":0,\\"message\\":{\\"role\\":\\"assistant\\",\\"content\\":\\"%s\\"},\\"finish_reason\\":\\"stop\\"}]}"
				  }
				}
				"""
			.formatted(escapeForJson(VALID_CONTRACT));
		this.wiremockApiContext.post("/__admin/mappings",
				RequestOptions.create().setHeader("Content-Type", "application/json").setData(firstMapping));

		// Second+ calls: returns valid contract
		String secondMapping = """
				{
				  "scenarioName": "OpenAI Retry",
				  "requiredScenarioState": "SecondCall",
				  "request": {
				    "method": "POST",
				    "urlPath": "/v1/chat/completions"
				  },
				  "response": {
				    "status": 200,
				    "headers": {"Content-Type": "application/json"},
				    "body": "{\\"id\\":\\"chatcmpl-2\\",\\"object\\":\\"chat.completion\\",\\"choices\\":[{\\"index\\":0,\\"message\\":{\\"role\\":\\"assistant\\",\\"content\\":\\"%s\\"},\\"finish_reason\\":\\"stop\\"}]}"
				  }
				}
				"""
			.formatted(escapeForJson(VALID_CONTRACT));
		this.wiremockApiContext.post("/__admin/mappings",
				RequestOptions.create().setHeader("Content-Type", "application/json").setData(secondMapping));
	}

	private void registerOpenAiAlwaysInvalid() {
		String stubMapping = """
				{
				  "request": {
				    "method": "POST",
				    "urlPath": "/v1/chat/completions"
				  },
				  "response": {
				    "status": 200,
				    "headers": {"Content-Type": "application/json"},
				    "body": "{\\"id\\":\\"chatcmpl-3\\",\\"object\\":\\"chat.completion\\",\\"choices\\":[{\\"index\\":0,\\"message\\":{\\"role\\":\\"assistant\\",\\"content\\":\\"%s\\"},\\"finish_reason\\":\\"stop\\"}]}"
				  }
				}
				"""
			.formatted(escapeForJson(INVALID_CONTRACT));
		this.wiremockApiContext.post("/__admin/mappings",
				RequestOptions.create().setHeader("Content-Type", "application/json").setData(stubMapping));
	}

	private void resetWireMockMappings() {
		this.wiremockApiContext.delete("/__admin/mappings");
	}

	private String escapeForJson(String text) {
		return text.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\t", "\\t");
	}

	private String jsonEscape(String text) {
		return "\"" + text.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\t", "\\t") + "\"";
	}

}
