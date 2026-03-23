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
package sh.stubborn.broker.application;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.flyway.autoconfigure.FlywayAutoConfiguration;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import sh.stubborn.broker.TestcontainersConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@Import(TestcontainersConfiguration.class)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ImportAutoConfiguration(FlywayAutoConfiguration.class)
class ApplicationRepositoryTest {

	@Autowired
	ApplicationRepository repository;

	@BeforeEach
	void cleanUp() {
		this.repository.deleteAll();
	}

	@Test
	void should_save_and_find_by_name() {
		// given
		Application app = Application.create("order-service", "Manages orders", "team-commerce");
		this.repository.save(app);

		// when
		Optional<Application> found = this.repository.findByName("order-service");

		// then
		assertThat(found).isPresent();
		assertThat(found.get().getName()).isEqualTo("order-service");
		assertThat(found.get().getDescription()).isEqualTo("Manages orders");
		assertThat(found.get().getOwner()).isEqualTo("team-commerce");
		assertThat(found.get().getId()).isNotNull();
		assertThat(found.get().getCreatedAt()).isNotNull();
		assertThat(found.get().getUpdatedAt()).isNotNull();
	}

	@Test
	void should_return_empty_when_not_found() {
		// when
		Optional<Application> found = this.repository.findByName("nonexistent");

		// then
		assertThat(found).isEmpty();
	}

	@Test
	void should_check_exists_by_name() {
		// given
		Application app = Application.create("order-service", "desc", "owner");
		this.repository.save(app);

		// then
		assertThat(this.repository.existsByName("order-service")).isTrue();
		assertThat(this.repository.existsByName("nonexistent")).isFalse();
	}

	@Test
	void should_list_with_pagination_and_sorting() {
		// given
		this.repository.save(Application.create("c-service", "desc", "owner"));
		this.repository.save(Application.create("a-service", "desc", "owner"));
		this.repository.save(Application.create("b-service", "desc", "owner"));

		// when
		Page<Application> page = this.repository.findAll(PageRequest.of(0, 2, Sort.by("name")));

		// then
		assertThat(page.getContent()).hasSize(2);
		assertThat(page.getTotalElements()).isEqualTo(3);
		assertThat(page.getContent().get(0).getName()).isEqualTo("a-service");
		assertThat(page.getContent().get(1).getName()).isEqualTo("b-service");
	}

	@Test
	void should_delete_by_name() {
		// given
		Application app = Application.create("order-service", "desc", "owner");
		this.repository.save(app);
		assertThat(this.repository.existsByName("order-service")).isTrue();

		// when
		this.repository.deleteByName("order-service");

		// then
		assertThat(this.repository.existsByName("order-service")).isFalse();
	}

}
