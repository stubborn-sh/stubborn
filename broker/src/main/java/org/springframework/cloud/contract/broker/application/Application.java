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
package org.springframework.cloud.contract.broker.application;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import org.jspecify.annotations.Nullable;

@Entity
@Table(name = "applications")
class Application {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(nullable = false, unique = true, length = 128)
	private String name;

	@Column(columnDefinition = "TEXT")
	private String description;

	@Column(nullable = false, length = 100)
	private String owner;

	@Column(name = "main_branch", length = 128)
	private String mainBranch;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	@Version
	private Long version;

	protected Application() {
	}

	private Application(String name, @Nullable String description, String owner, @Nullable String mainBranch) {
		ApplicationName.of(name);
		this.name = name;
		this.description = description;
		this.owner = owner;
		this.mainBranch = (mainBranch != null) ? mainBranch : "main";
		this.createdAt = Instant.now();
		this.updatedAt = this.createdAt;
	}

	static Application create(String name, @Nullable String description, String owner, @Nullable String mainBranch) {
		return new Application(name, description, owner, mainBranch);
	}

	static Application create(String name, @Nullable String description, String owner) {
		return create(name, description, owner, null);
	}

	void updateMainBranch(String mainBranch) {
		this.mainBranch = mainBranch;
		this.updatedAt = Instant.now();
	}

	UUID getId() {
		return this.id;
	}

	String getName() {
		return this.name;
	}

	String getDescription() {
		return this.description;
	}

	String getOwner() {
		return this.owner;
	}

	String getMainBranch() {
		return this.mainBranch;
	}

	Instant getCreatedAt() {
		return this.createdAt;
	}

	Instant getUpdatedAt() {
		return this.updatedAt;
	}

	Long getVersion() {
		return this.version;
	}

}
