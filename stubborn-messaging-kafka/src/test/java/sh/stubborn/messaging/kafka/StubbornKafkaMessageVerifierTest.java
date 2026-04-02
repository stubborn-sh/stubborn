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
package sh.stubborn.messaging.kafka;

import java.time.Duration;
import java.util.Map;

import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.ConsumerRecords;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.messaging.Message;
import org.springframework.messaging.support.MessageBuilder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * @see StubbornKafkaMessageVerifier
 */
@ExtendWith(MockitoExtension.class)
class StubbornKafkaMessageVerifierTest {

	@Mock
	private KafkaTemplate<String, Object> kafkaTemplate;

	@Test
	void should_send_message_to_destination() {
		// given
		StubbornKafkaProperties props = new StubbornKafkaProperties();
		StubbornKafkaMessageVerifier verifier = new StubbornKafkaMessageVerifier(this.kafkaTemplate, props);
		String destination = "verifications";
		Object payload = Map.of("eligible", true);

		// when
		verifier.send(payload, Map.of("contentType", "application/json"), destination, null);

		// then
		verify(this.kafkaTemplate).send(eq(destination), any());
	}

	@Test
	void should_send_message_with_correct_payload() {
		// given
		StubbornKafkaProperties props = new StubbornKafkaProperties();
		StubbornKafkaMessageVerifier verifier = new StubbornKafkaMessageVerifier(this.kafkaTemplate, props);
		Map<String, Object> payload = Map.of("eligible", true);

		// when
		verifier.send(payload, Map.of(), "test-topic", null);

		// then
		@SuppressWarnings("unchecked")
		ArgumentCaptor<Message<Object>> captor = ArgumentCaptor.forClass(Message.class);
		verify(this.kafkaTemplate).send(eq("test-topic"), captor.capture());
		assertThat(captor.getValue().getPayload()).isEqualTo(payload);
	}

	@Test
	void should_have_default_receive_timeout() {
		// given
		StubbornKafkaProperties props = new StubbornKafkaProperties();

		// then
		assertThat(props.getReceiveTimeout()).isEqualTo(Duration.ofSeconds(10));
	}

	@Test
	void should_have_default_image() {
		// given
		StubbornKafkaProperties props = new StubbornKafkaProperties();

		// then
		assertThat(props.getImage()).isEqualTo("apache/kafka");
	}

}
