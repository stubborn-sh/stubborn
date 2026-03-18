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

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.cloud.contract.broker.TestcontainersConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@Import(TestcontainersConfiguration.class)
class DeploymentRepositoryTest {

	@Autowired
	DeploymentRepository repository;

	@Autowired
	JdbcTemplate jdbcTemplate;

	UUID applicationId;

	@BeforeEach
	void setUp() {
		this.applicationId = UUID.randomUUID();
		this.jdbcTemplate.update(
				"INSERT INTO applications (id, name, description, owner, created_at, updated_at, version) VALUES (?, ?, ?, ?, NOW(), NOW(), 0)",
				this.applicationId, "deploy-test-app-" + this.applicationId.toString().substring(0, 8), "desc",
				"owner");
	}

	@Test
	void should_save_and_find_by_environment() {
		// given
		Deployment deployment = Deployment.create(this.applicationId, "production", "1.0.0");
		this.repository.save(deployment);

		// when
		List<Deployment> found = this.repository.findByEnvironment("production");

		// then
		assertThat(found).hasSize(1);
		assertThat(found.get(0).getApplicationId()).isEqualTo(this.applicationId);
		assertThat(found.get(0).getEnvironment()).isEqualTo("production");
		assertThat(found.get(0).getVersion()).isEqualTo("1.0.0");
		assertThat(found.get(0).getId()).isNotNull();
		assertThat(found.get(0).getDeployedAt()).isNotNull();
	}

	@Test
	void should_find_by_environment_paginated() {
		// given
		this.repository.save(Deployment.create(this.applicationId, "staging", "1.0.0"));
		UUID secondAppId = UUID.randomUUID();
		this.jdbcTemplate.update(
				"INSERT INTO applications (id, name, description, owner, created_at, updated_at, version) VALUES (?, ?, ?, ?, NOW(), NOW(), 0)",
				secondAppId, "deploy-test-app2-" + secondAppId.toString().substring(0, 8), "desc", "owner");
		this.repository.save(Deployment.create(secondAppId, "staging", "2.0.0"));

		// when
		Page<Deployment> page = this.repository.findByEnvironment("staging", PageRequest.of(0, 1));

		// then
		assertThat(page.getContent()).hasSize(1);
		assertThat(page.getTotalElements()).isEqualTo(2);
		assertThat(page.getTotalPages()).isEqualTo(2);
	}

	@Test
	void should_find_by_application_id_and_environment() {
		// given
		this.repository.save(Deployment.create(this.applicationId, "production", "1.0.0"));

		// when
		Optional<Deployment> found = this.repository.findByApplicationIdAndEnvironment(this.applicationId,
				"production");

		// then
		assertThat(found).isPresent();
		assertThat(found.get().getVersion()).isEqualTo("1.0.0");
	}

	@Test
	void should_return_empty_when_no_match() {
		// when
		Optional<Deployment> found = this.repository.findByApplicationIdAndEnvironment(this.applicationId,
				"nonexistent");

		// then
		assertThat(found).isEmpty();
	}

	@Test
	void should_update_version() {
		// given
		Deployment deployment = Deployment.create(this.applicationId, "production", "1.0.0");
		this.repository.save(deployment);
		UUID deploymentId = deployment.getId();

		// when
		deployment.updateVersion("2.0.0");
		this.repository.saveAndFlush(deployment);

		// then
		Optional<Deployment> reloaded = this.repository.findById(deploymentId);
		assertThat(reloaded).isPresent();
		assertThat(reloaded.get().getVersion()).isEqualTo("2.0.0");
	}

}
