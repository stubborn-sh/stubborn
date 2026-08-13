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

import java.time.Duration;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.testcontainers.kafka.KafkaContainer;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import sh.stubborn.contract.stubrunner.spring.AutoConfigureStubRunner;
import sh.stubborn.contract.stubrunner.StubFinder;
import sh.stubborn.contract.stubrunner.StubsMode;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

/**
 * Cross-language consumer contract test: JS producer → Java consumer.
 *
 * <p>
 * The JS {@code js-kafka-producer} publishes messaging contracts to the broker under
 * application name "js-verification-service". This Java consumer fetches those contracts
 * via {@code @AutoConfigureStubRunner} with {@code sccbroker://} and verifies the
 * {@code VerificationListener} can process the messages.
 *
 * <p>
 * The message format is identical to the Java producer — both publish the same
 * {@code VerificationResult} shape to the "verifications" topic. This test proves that a
 * Java consumer can work with contracts published by a JS producer.
 */
@Disabled("Messaging consumer path blocked by stubborn-messaging-kafka send bug "
		+ "(GenericMessage payload + StringSerializer) — see stubborn-sh/stubborn-contract#69")
@SpringBootTest(classes = VerificationProcessorApplication.class)
@AutoConfigureStubRunner(ids = "sh.stubborn:js-verification-service:1.0.0:stubs",
		repositoryRoot = "stubborn://http://localhost:18080", stubsMode = StubsMode.REMOTE,
		properties = { "stubborn.contract.stubrunner.username=reader",
				"stubborn.contract.stubrunner.password=reader" })
@Import(VerificationListenerJsStubsIT.KafkaContainerConfig.class)
class VerificationListenerJsStubsIT {

	@Configuration(proxyBeanMethods = false)
	static class KafkaContainerConfig {

		@Bean
		@ServiceConnection
		KafkaContainer kafkaContainer() {
			return new KafkaContainer("apache/kafka");
		}

	}

	@Autowired
	VerificationListener verificationListener;

	@Autowired
	StubFinder stubFinder;

	@Test
	void should_process_verification_message_from_js_producer_contract() {
		// given — trigger the labelled messaging contract (fetched from the JS producer's
		// stubs) so StubRunner sends the outputMessage to the "verifications" Kafka
		// topic;
		// messaging stubs are triggered by label, not auto-sent.
		boolean triggered = this.stubFinder.trigger("accepted_verification");
		assertThat(triggered).as("trigger 'accepted_verification'").isTrue();

		// then — the @KafkaListener consumes asynchronously, so poll until the message
		// has been received and processed instead of asserting immediately.
		await().atMost(Duration.ofSeconds(30)).untilAsserted(() -> {
			assertThat(this.verificationListener.getReceived()).isNotEmpty();
			assertThat(this.verificationListener.getReceived().getFirst().status()).isEqualTo("ACCEPTED");
		});
	}

}
