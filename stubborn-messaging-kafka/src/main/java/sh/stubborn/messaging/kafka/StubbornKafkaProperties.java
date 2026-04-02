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

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuration properties for Stubborn Kafka messaging support.
 */
@ConfigurationProperties(prefix = "stubborn.messaging.kafka")
public class StubbornKafkaProperties {

	private Duration receiveTimeout = Duration.ofSeconds(10);

	private String image = "apache/kafka";

	public Duration getReceiveTimeout() {
		return this.receiveTimeout;
	}

	public void setReceiveTimeout(Duration receiveTimeout) {
		this.receiveTimeout = receiveTimeout;
	}

	public String getImage() {
		return this.image;
	}

	public void setImage(String image) {
		this.image = image;
	}

}
