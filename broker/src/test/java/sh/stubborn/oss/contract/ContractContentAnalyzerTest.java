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
package sh.stubborn.oss.contract;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * @see sh.stubborn.oss.contract.ContractContentAnalyzer
 */
class ContractContentAnalyzerTest {

	private final ContractContentAnalyzer analyzer = new ContractContentAnalyzer();

	@Test
	void should_detect_messaging_contract_with_outputMessage_sentTo() {
		// given
		String content = """
				label: accepted_verification
				input:
				    triggeredBy: clientIsOldEnough()
				outputMessage:
				    sentTo: verifications
				    body:
				      eligible: true
				    headers:
				        contentType: application/json
				""";
		// when
		ContractAnalysis result = this.analyzer.analyze(content, "application/x-yaml");
		// then
		assertThat(result.interactionType()).isEqualTo(InteractionType.MESSAGING);
		assertThat(result.topics()).hasSize(1);
		assertThat(result.topics().getFirst().topicName()).isEqualTo("verifications");
		assertThat(result.topics().getFirst().direction()).isEqualTo(TopicDirection.PUBLISH);
	}

	@Test
	void should_detect_http_contract_with_request_response() {
		// given
		String content = """
				request:
				  method: GET
				  urlPath: /api/orders/1
				response:
				  status: 200
				  headers:
				    Content-Type: application/json
				  body:
				    id: "1"
				    product: "MacBook Pro"
				""";
		// when
		ContractAnalysis result = this.analyzer.analyze(content, "application/x-yaml");
		// then
		assertThat(result.interactionType()).isEqualTo(InteractionType.HTTP);
		assertThat(result.topics()).isEmpty();
	}

	@Test
	void should_default_to_http_when_content_is_unparseable() {
		// given
		String content = "this is not valid contract content: {{{";
		// when
		ContractAnalysis result = this.analyzer.analyze(content, "application/x-yaml");
		// then
		assertThat(result.interactionType()).isEqualTo(InteractionType.HTTP);
		assertThat(result.topics()).isEmpty();
	}

	@Test
	void should_default_to_http_when_content_is_empty() {
		// when
		ContractAnalysis result = this.analyzer.analyze("", "application/x-yaml");
		// then
		assertThat(result.interactionType()).isEqualTo(InteractionType.HTTP);
		assertThat(result.topics()).isEmpty();
	}

	@Test
	void should_extract_topic_from_messaging_contract_with_body_matchers() {
		// given
		String content = """
				label: trigger
				input:
				    triggeredBy: trigger()
				outputMessage:
				    sentTo: topic1
				    body:
				        foo: "example"
				""";
		// when
		ContractAnalysis result = this.analyzer.analyze(content, "application/x-yaml");
		// then
		assertThat(result.interactionType()).isEqualTo(InteractionType.MESSAGING);
		assertThat(result.topics()).hasSize(1);
		assertThat(result.topics().getFirst().topicName()).isEqualTo("topic1");
		assertThat(result.topics().getFirst().direction()).isEqualTo(TopicDirection.PUBLISH);
	}

	@Test
	void should_handle_http_contract_with_matchers() {
		// given
		String content = """
				request:
				  method: POST
				  url: /api/orders
				  headers:
				    Content-Type: application/json
				  body:
				    product: "iPhone 16"
				    amount: 999.99
				response:
				  status: 201
				  headers:
				    Content-Type: application/json
				  body:
				    product: "iPhone 16"
				  matchers:
				    body:
				      - path: $.id
				        type: by_regex
				        value: "[0-9]+"
				""";
		// when
		ContractAnalysis result = this.analyzer.analyze(content, "application/x-yaml");
		// then
		assertThat(result.interactionType()).isEqualTo(InteractionType.HTTP);
		assertThat(result.topics()).isEmpty();
	}

}
