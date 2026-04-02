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

import java.util.Map;
import java.util.concurrent.TimeUnit;

import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.cloud.contract.verifier.converter.YamlContract;
import org.springframework.cloud.contract.verifier.messaging.MessageVerifierReceiver;
import org.springframework.cloud.contract.verifier.messaging.MessageVerifierSender;
import org.springframework.messaging.Message;
import org.springframework.messaging.support.MessageBuilder;

/**
 * Implements both {@link MessageVerifierSender} and {@link MessageVerifierReceiver} for
 * RabbitMQ using Spring AMQP's {@link RabbitTemplate}.
 */
class StubbornRabbitMessageVerifier implements MessageVerifierSender<Message<?>>, MessageVerifierReceiver<Message<?>> {

	private static final Logger log = LoggerFactory.getLogger(StubbornRabbitMessageVerifier.class);

	private final RabbitTemplate rabbitTemplate;

	private final StubbornRabbitProperties properties;

	StubbornRabbitMessageVerifier(RabbitTemplate rabbitTemplate, StubbornRabbitProperties properties) {
		this.rabbitTemplate = rabbitTemplate;
		this.properties = properties;
	}

	@Override
	public void send(Message<?> message, String destination, @Nullable YamlContract contract) {
		log.info("Sending message to RabbitMQ destination '{}': {}", destination, message.getPayload());
		this.rabbitTemplate.convertAndSend(destination, message.getPayload(), (m) -> {
			copyHeaders(message.getHeaders(), m.getMessageProperties());
			return m;
		});
	}

	@Override
	public <T> void send(T payload, Map<String, Object> headers, String destination, @Nullable YamlContract contract) {
		log.info("Sending message to RabbitMQ destination '{}': {}", destination, payload);
		this.rabbitTemplate.convertAndSend(destination, payload, (m) -> {
			copyHeaders(headers, m.getMessageProperties());
			return m;
		});
	}

	@Override
	public @Nullable Message<?> receive(String destination, long timeout, TimeUnit timeUnit,
			@Nullable YamlContract contract) {
		long timeoutMs = timeUnit.toMillis(timeout);
		log.info("Receiving message from RabbitMQ '{}' with timeout {}ms", destination, timeoutMs);
		this.rabbitTemplate.setReceiveTimeout(timeoutMs);
		org.springframework.amqp.core.@Nullable Message amqpMessage = this.rabbitTemplate.receive(destination);
		if (amqpMessage != null) {
			Object body = this.rabbitTemplate.getMessageConverter().fromMessage(amqpMessage);
			log.info("Received message from '{}': {}", destination, body);
			return MessageBuilder.withPayload(body).build();
		}
		log.warn("No message received from '{}' within {}ms", destination, timeoutMs);
		return null;
	}

	@Override
	public @Nullable Message<?> receive(String destination, @Nullable YamlContract contract) {
		return receive(destination, this.properties.getReceiveTimeout().toMillis(), TimeUnit.MILLISECONDS, contract);
	}

	private static void copyHeaders(Map<String, Object> headers, MessageProperties props) {
		headers.forEach((key, value) -> {
			if ("contentType".equals(key) && value instanceof String s) {
				props.setContentType(s);
			}
			else {
				props.setHeader(key, value);
			}
		});
	}

}
