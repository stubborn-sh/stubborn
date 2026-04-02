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

import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.Test;

import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.cloud.contract.verifier.converter.YamlContract;
import org.springframework.cloud.contract.verifier.messaging.MessageVerifierReceiver;
import org.springframework.cloud.contract.verifier.messaging.MessageVerifierSender;
import org.springframework.messaging.Message;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/**
 * @see StubbornRabbitAutoConfiguration
 */
class StubbornRabbitAutoConfigurationTest {

	private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
		.withConfiguration(AutoConfigurations.of(StubbornRabbitAutoConfiguration.class))
		.withBean(RabbitTemplate.class, () -> mock(RabbitTemplate.class));

	@Test
	void should_register_message_verifier_sender_bean() {
		this.contextRunner.run((context) -> {
			assertThat(context).hasSingleBean(MessageVerifierSender.class);
			assertThat(context.getBean(MessageVerifierSender.class)).isInstanceOf(StubbornRabbitMessageVerifier.class);
		});
	}

	@Test
	void should_register_message_verifier_receiver_bean() {
		this.contextRunner.run((context) -> {
			assertThat(context).hasSingleBean(MessageVerifierReceiver.class);
			assertThat(context.getBean(MessageVerifierReceiver.class))
				.isInstanceOf(StubbornRabbitMessageVerifier.class);
		});
	}

	@Test
	void should_not_register_beans_when_rabbit_is_missing() {
		new ApplicationContextRunner().withConfiguration(AutoConfigurations.of(StubbornRabbitAutoConfiguration.class))
			.withClassLoader(new FilteredClassLoader("org.springframework.amqp"))
			.run((context) -> {
				assertThat(context).doesNotHaveBean(MessageVerifierSender.class);
				assertThat(context).doesNotHaveBean(MessageVerifierReceiver.class);
			});
	}

	@Test
	void should_back_off_when_user_provides_sender() {
		this.contextRunner.withBean("customSender", MessageVerifierSender.class, () -> new StubMessageVerifierSender())
			.run((context) -> {
				assertThat(context).hasSingleBean(MessageVerifierSender.class);
				assertThat(context.getBean(MessageVerifierSender.class))
					.isNotInstanceOf(StubbornRabbitMessageVerifier.class);
			});
	}

	@Test
	void should_bind_properties() {
		this.contextRunner
			.withPropertyValues("stubborn.messaging.rabbit.receive-timeout=5s",
					"stubborn.messaging.rabbit.image=rabbitmq:3-management")
			.run((context) -> {
				assertThat(context).hasSingleBean(StubbornRabbitProperties.class);
				StubbornRabbitProperties props = context.getBean(StubbornRabbitProperties.class);
				assertThat(props.getReceiveTimeout()).hasSeconds(5);
				assertThat(props.getImage()).isEqualTo("rabbitmq:3-management");
			});
	}

	/**
	 * Stub implementation of {@link MessageVerifierSender} for testing back-off behavior.
	 */
	static class StubMessageVerifierSender implements MessageVerifierSender<Message<?>> {

		@Override
		public void send(Message<?> message, String destination, @Nullable YamlContract contract) {
		}

		@Override
		public <T> void send(T payload, Map<String, Object> headers, String destination,
				@Nullable YamlContract contract) {
		}

	}

}
