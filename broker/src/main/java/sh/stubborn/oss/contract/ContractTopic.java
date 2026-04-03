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
package sh.stubborn.oss.contract;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "contract_topics")
class ContractTopic {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(name = "contract_id", nullable = false)
	private UUID contractId;

	@Column(name = "application_id", nullable = false)
	private UUID applicationId;

	@Column(nullable = false, length = 64)
	private String version;

	@Column(name = "topic_name", nullable = false, length = 256)
	private String topicName;

	@Column(nullable = false, length = 10)
	private String direction;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	protected ContractTopic() {
	}

	static ContractTopic create(UUID contractId, UUID applicationId, String version, String topicName,
			TopicDirection direction) {
		ContractTopic topic = new ContractTopic();
		topic.contractId = contractId;
		topic.applicationId = applicationId;
		topic.version = version;
		topic.topicName = topicName;
		topic.direction = direction.name();
		topic.createdAt = Instant.now();
		return topic;
	}

	UUID getId() {
		return this.id;
	}

	UUID getContractId() {
		return this.contractId;
	}

	UUID getApplicationId() {
		return this.applicationId;
	}

	String getVersion() {
		return this.version;
	}

	String getTopicName() {
		return this.topicName;
	}

	String getDirection() {
		return this.direction;
	}

	Instant getCreatedAt() {
		return this.createdAt;
	}

}
