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
package sh.stubborn.messaging.rabbit;

import java.time.Duration;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.amqp.rabbit.core.RabbitTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import org.springframework.amqp.core.MessagePostProcessor;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;

/**
 * @see StubbornRabbitMessageVerifier
 */
@ExtendWith(MockitoExtension.class)
class StubbornRabbitMessageVerifierTest {

	@Mock
	private RabbitTemplate rabbitTemplate;

	@Test
	void should_send_message_to_destination() {
		// given
		StubbornRabbitProperties props = new StubbornRabbitProperties();
		StubbornRabbitMessageVerifier verifier = new StubbornRabbitMessageVerifier(this.rabbitTemplate, props);
		Map<String, Object> payload = Map.of("eligible", true);

		// when
		verifier.send(payload, Map.of("contentType", "application/json"), "notifications", null);

		// then
		verify(this.rabbitTemplate).convertAndSend(eq("notifications"), eq(payload), any(MessagePostProcessor.class));
	}

	@Test
	void should_have_default_receive_timeout() {
		// given
		StubbornRabbitProperties props = new StubbornRabbitProperties();

		// then
		assertThat(props.getReceiveTimeout()).isEqualTo(Duration.ofSeconds(10));
	}

	@Test
	void should_have_default_image() {
		// given
		StubbornRabbitProperties props = new StubbornRabbitProperties();

		// then
		assertThat(props.getImage()).isEqualTo("rabbitmq:4-management-alpine");
	}

}
