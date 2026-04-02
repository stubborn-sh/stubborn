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
import java.util.Collections;
import java.util.Map;
import java.util.Properties;
import java.util.concurrent.TimeUnit;

import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.ConsumerRecords;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.cloud.contract.verifier.converter.YamlContract;
import org.springframework.cloud.contract.verifier.messaging.MessageVerifierReceiver;
import org.springframework.cloud.contract.verifier.messaging.MessageVerifierSender;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.messaging.Message;
import org.springframework.messaging.support.MessageBuilder;

/**
 * Implements both {@link MessageVerifierSender} and {@link MessageVerifierReceiver} for
 * Kafka using Spring Kafka's {@link KafkaTemplate}.
 */
class StubbornKafkaMessageVerifier implements MessageVerifierSender<Message<?>>, MessageVerifierReceiver<Message<?>> {

	private static final Logger log = LoggerFactory.getLogger(StubbornKafkaMessageVerifier.class);

	private final KafkaTemplate<String, Object> kafkaTemplate;

	private final StubbornKafkaProperties properties;

	StubbornKafkaMessageVerifier(KafkaTemplate<String, Object> kafkaTemplate, StubbornKafkaProperties properties) {
		this.kafkaTemplate = kafkaTemplate;
		this.properties = properties;
	}

	@Override
	public void send(Message<?> message, String destination, @Nullable YamlContract contract) {
		log.info("Sending message to Kafka topic '{}': {}", destination, message.getPayload());
		var unused = this.kafkaTemplate.send(destination, message);
	}

	@Override
	public <T> void send(T payload, Map<String, Object> headers, String destination, @Nullable YamlContract contract) {
		Message<T> message = MessageBuilder.withPayload(payload).copyHeaders(headers).build();
		log.info("Sending message to Kafka topic '{}': {}", destination, payload);
		var unused = this.kafkaTemplate.send(destination, message);
	}

	@Override
	public @Nullable Message<?> receive(String destination, long timeout, TimeUnit timeUnit,
			@Nullable YamlContract contract) {
		Duration pollDuration = Duration.ofMillis(timeUnit.toMillis(timeout));
		log.info("Receiving message from Kafka topic '{}' with timeout {}", destination, pollDuration);
		Properties consumerProps = buildConsumerProperties();
		try (KafkaConsumer<String, Object> consumer = new KafkaConsumer<>(consumerProps)) {
			consumer.subscribe(Collections.singletonList(destination));
			ConsumerRecords<String, Object> records = consumer.poll(pollDuration);
			for (ConsumerRecord<String, Object> record : records) {
				log.info("Received message from '{}': {}", destination, record.value());
				return MessageBuilder.withPayload(record.value()).build();
			}
		}
		log.warn("No message received from '{}' within {}", destination, pollDuration);
		return null;
	}

	@Override
	public @Nullable Message<?> receive(String destination, @Nullable YamlContract contract) {
		return receive(destination, this.properties.getReceiveTimeout().toSeconds(), TimeUnit.SECONDS, contract);
	}

	private Properties buildConsumerProperties() {
		String bootstrapServers = this.kafkaTemplate.getProducerFactory()
			.getConfigurationProperties()
			.getOrDefault("bootstrap.servers", "localhost:9092")
			.toString();
		Properties props = new Properties();
		props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
		props.put(ConsumerConfig.GROUP_ID_CONFIG, "stubborn-verifier-" + System.nanoTime());
		props.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
		props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());
		props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());
		return props;
	}

}
