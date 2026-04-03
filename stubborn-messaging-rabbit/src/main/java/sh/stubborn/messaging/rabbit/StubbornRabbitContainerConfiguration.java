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

import org.testcontainers.containers.RabbitMQContainer;

import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.AutoConfigureAfter;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;

/**
 * Auto-configuration that provides a Testcontainers-managed RabbitMQ broker with
 * {@link ServiceConnection} for automatic connection property wiring.
 */
@AutoConfiguration
@ConditionalOnClass(RabbitMQContainer.class)
@AutoConfigureAfter(StubbornRabbitAutoConfiguration.class)
public class StubbornRabbitContainerConfiguration {

	@Bean
	@ConditionalOnMissingBean
	@ServiceConnection
	RabbitMQContainer rabbitMQContainer(StubbornRabbitProperties properties) {
		return new RabbitMQContainer(properties.getImage());
	}

}
