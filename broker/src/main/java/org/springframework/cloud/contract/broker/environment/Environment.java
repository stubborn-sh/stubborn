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
package org.springframework.cloud.contract.broker.environment;

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
@Table(name = "environments")
class Environment {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(nullable = false, unique = true, length = 64)
	private String name;

	@Nullable
	@Column(columnDefinition = "TEXT")
	private String description;

	@Column(name = "display_order", nullable = false)
	private int displayOrder;

	@Column(nullable = false)
	private boolean production;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	@Version
	@Column(name = "row_version")
	private Long rowVersion;

	protected Environment() {
	}

	private Environment(String name, @Nullable String description, int displayOrder, boolean production) {
		this.name = name;
		this.description = description;
		this.displayOrder = displayOrder;
		this.production = production;
		this.createdAt = Instant.now();
		this.updatedAt = Instant.now();
	}

	static Environment create(String name, @Nullable String description, int displayOrder, boolean production) {
		return new Environment(name, description, displayOrder, production);
	}

	void update(@Nullable String description, int displayOrder, boolean production) {
		this.description = description;
		this.displayOrder = displayOrder;
		this.production = production;
		this.updatedAt = Instant.now();
	}

	UUID getId() {
		return this.id;
	}

	String getName() {
		return this.name;
	}

	@Nullable String getDescription() {
		return this.description;
	}

	int getDisplayOrder() {
		return this.displayOrder;
	}

	boolean isProduction() {
		return this.production;
	}

	Instant getCreatedAt() {
		return this.createdAt;
	}

	Instant getUpdatedAt() {
		return this.updatedAt;
	}

}
