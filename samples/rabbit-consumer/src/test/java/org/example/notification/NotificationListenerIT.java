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

import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cloud.contract.stubrunner.spring.AutoConfigureStubRunner;
import org.springframework.cloud.contract.stubrunner.spring.StubRunnerProperties;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Consumer contract test using {@code @AutoConfigureStubRunner} with sccbroker:// to
 * fetch messaging contracts from the broker and send them to RabbitMQ.
 *
 * <p>
 * The {@code stubborn-messaging-rabbit} auto-configuration provides the
 * {@code MessageVerifierSender} and {@code MessageVerifierReceiver} beans, so StubRunner
 * can send the contract-defined message to the RabbitMQ queue. The
 * {@code NotificationListener} processes it, and we assert it was received.
 */
@SpringBootTest
@AutoConfigureStubRunner(ids = "sh.stubborn:notification-service:1.0.0:stubs",
		repositoryRoot = "sccbroker://http://localhost:18080", stubsMode = StubRunnerProperties.StubsMode.REMOTE,
		properties = { "spring.cloud.contract.stubrunner.username=reader",
				"spring.cloud.contract.stubrunner.password=reader" })
class NotificationListenerIT {

	@Autowired
	NotificationListener notificationListener;

	@Test
	void should_process_notification_message_from_contract() {
		// given — StubRunner sends the contract-defined message to RabbitMQ at startup

		// then — listener should have received and processed the message
		assertThat(this.notificationListener.getReceived()).isNotEmpty();
		assertThat(this.notificationListener.getReceived().getFirst().type()).isEqualTo("ORDER_CONFIRMED");
	}

}
