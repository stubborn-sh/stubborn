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

import org.testcontainers.containers.RabbitMQContainer;

import org.junit.jupiter.api.BeforeEach;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.cloud.contract.verifier.messaging.boot.AutoConfigureMessageVerifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;

/**
 * Base class for SCC-generated messaging contract tests.
 *
 * <p>
 * The {@code triggerNotification()} method is referenced by the contract's
 * {@code input.triggeredBy} field. SCC calls it to trigger message production, then
 * asserts the output message matches the contract.
 *
 * <p>
 * {@code @AutoConfigureMessageVerifier} activates the {@code stubborn-messaging-rabbit}
 * auto-configuration, which provides {@code MessageVerifierSender} and
 * {@code MessageVerifierReceiver} beans. The inner {@code Configuration} provides a
 * Testcontainers-managed RabbitMQ instance via {@code @ServiceConnection}.
 */
@SpringBootTest
@AutoConfigureMessageVerifier
@Import(NotificationContractBase.RabbitContainerConfig.class)
public abstract class NotificationContractBase {

	@Configuration(proxyBeanMethods = false)
	static class RabbitContainerConfig {

		@Bean
		@ServiceConnection
		RabbitMQContainer rabbitMQContainer() {
			return new RabbitMQContainer("rabbitmq:4-management-alpine");
		}

	}

	@Autowired
	NotificationService notificationService;

	@BeforeEach
	void setUp() {
		// no-op — Spring context provides all beans
	}

	public void triggerNotification() {
		this.notificationService.sendNotification(
				new NotificationEvent("ORDER_CONFIRMED", "user@example.com", "Your order has been confirmed"));
	}

}
