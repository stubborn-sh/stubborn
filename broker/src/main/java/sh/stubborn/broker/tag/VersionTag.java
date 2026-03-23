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
package sh.stubborn.broker.tag;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "version_tags")
class VersionTag {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(name = "application_id", nullable = false)
	private UUID applicationId;

	@Column(nullable = false, length = 64)
	private String version;

	@Column(nullable = false, length = 128)
	private String tag;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	protected VersionTag() {
	}

	private VersionTag(UUID applicationId, String version, String tag) {
		this.applicationId = applicationId;
		this.version = version;
		this.tag = tag;
		this.createdAt = Instant.now();
	}

	static VersionTag create(UUID applicationId, String version, String tag) {
		return new VersionTag(applicationId, version, tag);
	}

	UUID getId() {
		return this.id;
	}

	UUID getApplicationId() {
		return this.applicationId;
	}

	String getVersion() {
		return this.version;
	}

	String getTag() {
		return this.tag;
	}

	Instant getCreatedAt() {
		return this.createdAt;
	}

}
