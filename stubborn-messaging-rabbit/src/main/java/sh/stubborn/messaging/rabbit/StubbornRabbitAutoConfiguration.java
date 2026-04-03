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

import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.AutoConfigureBefore;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.cloud.contract.verifier.messaging.MessageVerifierReceiver;
import org.springframework.cloud.contract.verifier.messaging.MessageVerifierSender;
import org.springframework.cloud.contract.verifier.messaging.integration.ContractVerifierIntegrationConfiguration;
import org.springframework.cloud.contract.verifier.messaging.noop.NoOpContractVerifierAutoConfiguration;
import org.springframework.context.annotation.Bean;

/**
 * Auto-configuration for Stubborn RabbitMQ messaging contract test support. Activates
 * when {@link RabbitTemplate} is on the classpath and provides a
 * {@link StubbornRabbitMessageVerifier} that implements both
 * {@link MessageVerifierSender} and {@link MessageVerifierReceiver}.
 *
 * <p>
 * Configured to run before SCC's built-in messaging integrations so that the RabbitMQ
 * verifier takes precedence when RabbitMQ is on the classpath.
 */
@AutoConfiguration
@ConditionalOnClass(RabbitTemplate.class)
@AutoConfigureBefore({ ContractVerifierIntegrationConfiguration.class, NoOpContractVerifierAutoConfiguration.class })
@EnableConfigurationProperties(StubbornRabbitProperties.class)
public class StubbornRabbitAutoConfiguration {

	@Bean
	@ConditionalOnMissingBean(MessageVerifierSender.class)
	StubbornRabbitMessageVerifier stubbornRabbitMessageVerifier(RabbitTemplate rabbitTemplate,
			StubbornRabbitProperties properties) {
		return new StubbornRabbitMessageVerifier(rabbitTemplate, properties);
	}

}
