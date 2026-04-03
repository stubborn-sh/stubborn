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
package org.example.verification;

import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cloud.contract.stubrunner.spring.AutoConfigureStubRunner;
import org.springframework.cloud.contract.stubrunner.spring.StubRunnerProperties;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Cross-language consumer contract test: JS producer → Java consumer.
 *
 * <p>
 * The JS {@code js-kafka-producer} publishes messaging contracts to the broker
 * under application name "js-verification-service". This Java consumer fetches
 * those contracts via {@code @AutoConfigureStubRunner} with {@code sccbroker://}
 * and verifies the {@code VerificationListener} can process the messages.
 *
 * <p>
 * The message format is identical to the Java producer — both publish the same
 * {@code VerificationResult} shape to the "verifications" topic. This test proves
 * that a Java consumer can work with contracts published by a JS producer.
 */
@SpringBootTest
@AutoConfigureStubRunner(ids = "sh.stubborn:js-verification-service:1.0.0:stubs",
		repositoryRoot = "sccbroker://http://localhost:18080", stubsMode = StubRunnerProperties.StubsMode.REMOTE,
		properties = { "spring.cloud.contract.stubrunner.username=reader",
				"spring.cloud.contract.stubrunner.password=reader" })
class VerificationListenerJsStubsIT {

	@Autowired
	VerificationListener verificationListener;

	@Test
	void should_process_verification_message_from_js_producer_contract() {
		// given — StubRunner fetches JS producer contracts from broker and sends
		// the message to Kafka

		// then — listener should have received and processed the message
		assertThat(this.verificationListener.getReceived()).isNotEmpty();
		assertThat(this.verificationListener.getReceived().getFirst().status()).isEqualTo("ACCEPTED");
	}

}
