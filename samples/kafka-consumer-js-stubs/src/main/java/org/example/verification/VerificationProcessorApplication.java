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
package org.example.verification;

import org.apache.kafka.clients.admin.NewTopic;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.kafka.config.TopicBuilder;

@SpringBootApplication
public class VerificationProcessorApplication {

	public static void main(String[] args) {
		SpringApplication.run(VerificationProcessorApplication.class, args);
	}

	/**
	 * Declare the "verifications" topic so KafkaAdmin creates it at startup. Without this,
	 * StubRunner's producer can send the contract message before the listener's subscription
	 * has auto-created the topic, failing with "Topic verifications not present in metadata".
	 */
	@Bean
	NewTopic verificationsTopic() {
		return TopicBuilder.name("verifications").partitions(1).replicas(1).build();
	}

}
