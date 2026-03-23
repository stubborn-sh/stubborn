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
package sh.stubborn.broker.environment;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

@Entity
@Table(name = "deployments")
class Deployment {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(name = "application_id", nullable = false)
	private UUID applicationId;

	@Column(nullable = false, length = 64)
	private String environment;

	@Column(nullable = false, length = 64)
	private String version;

	@Column(name = "deployed_at", nullable = false)
	private Instant deployedAt;

	@Version
	@Column(name = "row_version")
	private Long rowVersion;

	protected Deployment() {
	}

	private Deployment(UUID applicationId, String environment, String version) {
		this.applicationId = applicationId;
		this.environment = environment;
		this.version = version;
		this.deployedAt = Instant.now();
	}

	static Deployment create(UUID applicationId, String environment, String version) {
		return new Deployment(applicationId, environment, version);
	}

	void updateVersion(String version) {
		this.version = version;
		this.deployedAt = Instant.now();
	}

	UUID getId() {
		return this.id;
	}

	UUID getApplicationId() {
		return this.applicationId;
	}

	String getEnvironment() {
		return this.environment;
	}

	String getVersion() {
		return this.version;
	}

	Instant getDeployedAt() {
		return this.deployedAt;
	}

}
