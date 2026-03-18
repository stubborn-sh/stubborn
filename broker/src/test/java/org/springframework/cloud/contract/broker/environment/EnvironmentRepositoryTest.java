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

import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.cloud.contract.broker.TestcontainersConfiguration;
import org.springframework.context.annotation.Import;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@Import(TestcontainersConfiguration.class)
class EnvironmentRepositoryTest {

	@Autowired
	EnvironmentRepository repository;

	@Test
	void should_save_and_find_by_name() {
		// given
		Environment env = Environment.create("staging", "Pre-production", 1, false);
		this.repository.saveAndFlush(env);
		// when
		Optional<Environment> found = this.repository.findByName("staging");
		// then
		assertThat(found).isPresent();
		assertThat(found.get().getName()).isEqualTo("staging");
		assertThat(found.get().getDescription()).isEqualTo("Pre-production");
		assertThat(found.get().getDisplayOrder()).isEqualTo(1);
		assertThat(found.get().isProduction()).isFalse();
	}

	@Test
	void should_return_empty_when_name_not_found() {
		// when
		Optional<Environment> found = this.repository.findByName("nonexistent");
		// then
		assertThat(found).isEmpty();
	}

	@Test
	void should_check_exists_by_name() {
		// given
		this.repository.saveAndFlush(Environment.create("production", "Prod", 0, true));
		// when / then
		assertThat(this.repository.existsByName("production")).isTrue();
		assertThat(this.repository.existsByName("nonexistent")).isFalse();
	}

	@Test
	void should_find_all_ordered_by_display_order_then_name() {
		// given
		this.repository.saveAndFlush(Environment.create("production", null, 2, true));
		this.repository.saveAndFlush(Environment.create("staging", null, 1, false));
		this.repository.saveAndFlush(Environment.create("dev", null, 0, false));
		this.repository.saveAndFlush(Environment.create("alpha", null, 0, false));
		// when
		List<Environment> envs = this.repository.findAllByOrderByDisplayOrderAscNameAsc();
		// then
		assertThat(envs).hasSize(4);
		assertThat(envs.get(0).getName()).isEqualTo("alpha");
		assertThat(envs.get(1).getName()).isEqualTo("dev");
		assertThat(envs.get(2).getName()).isEqualTo("staging");
		assertThat(envs.get(3).getName()).isEqualTo("production");
	}

	@Test
	void should_delete_by_name() {
		// given
		this.repository.saveAndFlush(Environment.create("temp", null, 0, false));
		assertThat(this.repository.existsByName("temp")).isTrue();
		// when
		this.repository.deleteByName("temp");
		this.repository.flush();
		// then
		assertThat(this.repository.existsByName("temp")).isFalse();
	}

}
