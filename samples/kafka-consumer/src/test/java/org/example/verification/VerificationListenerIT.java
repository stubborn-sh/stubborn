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
 * Consumer contract test using {@code @AutoConfigureStubRunner} with sccbroker:// to
 * fetch messaging contracts from the broker and send them to Kafka.
 *
 * <p>
 * The Spring-free {@code stubborn-contract-messaging-kafka} building block supplies the
 * {@code StubbornKafkaMessageVerifier}, which {@code @AutoConfigureStubRunner} wires (via
 * {@code @AutoConfigureMessageVerifier}) as the {@code MessageVerifierSender} /
 * {@code MessageVerifierReceiver} beans, so StubRunner can send the contract-defined
 * message to the Kafka topic. The {@code VerificationListener} processes it, and we assert
 * it was received.
 */
@SpringBootTest(classes = VerificationProcessorApplication.class)
@AutoConfigureStubRunner(ids = "sh.stubborn:verification-service:1.0.0:stubs",
		repositoryRoot = "stubborn://http://localhost:18080", stubsMode = StubsMode.REMOTE,
		properties = { "stubborn.contract.stubrunner.username=reader",
				"stubborn.contract.stubrunner.password=reader" })
@Import(VerificationListenerIT.KafkaContainerConfig.class)
class VerificationListenerIT {

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
	void should_process_verification_message_from_contract() {
		// given — trigger the messaging contract's labelled message so StubRunner sends
		// the outputMessage to the "verifications" Kafka topic (messaging stubs are not
		// auto-sent; they are triggered by label).
		boolean triggered = this.stubFinder.trigger("accepted_verification");
		assertThat(triggered).as("trigger 'accepted_verification'").isTrue();

		// then — the @KafkaListener consumes asynchronously (send -> Kafka -> consumer
		// group assignment -> deliver), so poll until the message has been processed
		// instead of asserting immediately.
		await().atMost(Duration.ofSeconds(30)).untilAsserted(() -> {
			assertThat(this.verificationListener.getReceived()).isNotEmpty();
			assertThat(this.verificationListener.getReceived().getFirst().status()).isEqualTo("ACCEPTED");
		});
	}

}
