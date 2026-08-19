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
package org.example.notification;

import java.time.Duration;

import org.junit.jupiter.api.Test;
import org.testcontainers.activemq.ArtemisContainer;
import org.testcontainers.utility.DockerImageName;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import sh.stubborn.contract.stubrunner.StubFinder;
import sh.stubborn.contract.stubrunner.StubsMode;
import sh.stubborn.contract.stubrunner.spring.AutoConfigureStubRunner;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

/**
 * Consumer contract test using {@code @AutoConfigureStubRunner} with {@code stubborn://}
 * to fetch messaging contracts from the broker and send them to JMS (ActiveMQ Artemis).
 *
 * <p>
 * The Spring-free {@code stubborn-contract-messaging-jms} building block supplies the
 * {@code StubbornJmsMessageVerifierSender}, which {@code @AutoConfigureStubRunner} wires
 * (via {@code @AutoConfigureMessageVerifier}) so StubRunner can send the contract-defined
 * message to the {@code notifications} queue on a Testcontainers-managed Artemis broker.
 * The {@code NotificationListener} binds it to the typed {@code NotificationEvent} record
 * with <strong>no</strong> hand-configured {@code MessageConverter} — the out-of-the-box
 * JSON conversion does that — and we assert it was received.
 */
@SpringBootTest(classes = NotificationProcessorApplication.class)
@AutoConfigureStubRunner(ids = "sh.stubborn:notification-jms-service:1.0.0:stubs",
		repositoryRoot = "stubborn://http://localhost:18080", stubsMode = StubsMode.REMOTE,
		properties = { "stubborn.contract.stubrunner.username=reader", "stubborn.contract.stubrunner.password=reader" })
@Import(NotificationListenerIT.ArtemisContainerConfig.class)
class NotificationListenerIT {

	@Configuration(proxyBeanMethods = false)
	static class ArtemisContainerConfig {

		@Bean
		@ServiceConnection
		ArtemisContainer artemisContainer() {
			return new ArtemisContainer(DockerImageName.parse("apache/activemq-artemis:2.43.0"));
		}

	}

	@Autowired
	NotificationListener notificationListener;

	@Autowired
	StubFinder stubFinder;

	@Test
	void should_process_notification_message_from_contract() {
		// given — trigger the messaging contract's labelled message so StubRunner sends
		// the
		// outputMessage to the "notifications" JMS queue (messaging stubs are not
		// auto-sent;
		// they are triggered by label).
		boolean triggered = this.stubFinder.trigger("order_confirmation");
		assertThat(triggered).as("trigger 'order_confirmation'").isTrue();

		// then — the @JmsListener consumes asynchronously, so poll until the message has
		// been
		// received and bound to the typed record instead of asserting immediately.
		await().atMost(Duration.ofSeconds(30)).untilAsserted(() -> {
			assertThat(this.notificationListener.getReceived()).isNotEmpty();
			assertThat(this.notificationListener.getReceived().get(0).type()).isEqualTo("ORDER_CONFIRMED");
		});
	}

}
