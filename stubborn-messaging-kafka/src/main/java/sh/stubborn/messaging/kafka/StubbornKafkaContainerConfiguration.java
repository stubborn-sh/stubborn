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

import org.testcontainers.kafka.KafkaContainer;

import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;

/**
 * Auto-configuration that provides a Testcontainers-managed Kafka broker with
 * {@link ServiceConnection} for automatic bootstrap-servers wiring.
 */
@AutoConfiguration
@ConditionalOnClass(KafkaContainer.class)
public class StubbornKafkaContainerConfiguration {

	@Bean
	@ConditionalOnMissingBean
	@ServiceConnection
	KafkaContainer kafkaContainer(StubbornKafkaProperties properties) {
		return new KafkaContainer(properties.getImage());
	}

}
