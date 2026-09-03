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
package sh.stubborn.oss.dependency;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * A consumer's declared dependency on a provider, stated up front rather than inferred
 * from verification history.
 */
@Entity
@Table(name = "dependencies")
class Dependency {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(name = "consumer_id", nullable = false)
	private UUID consumerId;

	@Column(name = "consumer_version", nullable = false, length = 64)
	private String consumerVersion;

	@Column(name = "provider_id", nullable = false)
	private UUID providerId;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private DependencySource source;

	@Column(name = "declared_at", nullable = false, updatable = false)
	private Instant declaredAt;

	protected Dependency() {
	}

	static Dependency create(UUID consumerId, String consumerVersion, UUID providerId, DependencySource source) {
		Dependency dependency = new Dependency();
		dependency.consumerId = consumerId;
		dependency.consumerVersion = consumerVersion;
		dependency.providerId = providerId;
		dependency.source = source;
		dependency.declaredAt = Instant.now();
		return dependency;
	}

	UUID getId() {
		return this.id;
	}

	UUID getConsumerId() {
		return this.consumerId;
	}

	String getConsumerVersion() {
		return this.consumerVersion;
	}

	UUID getProviderId() {
		return this.providerId;
	}

	DependencySource getSource() {
		return this.source;
	}

	Instant getDeclaredAt() {
		return this.declaredAt;
	}

}
