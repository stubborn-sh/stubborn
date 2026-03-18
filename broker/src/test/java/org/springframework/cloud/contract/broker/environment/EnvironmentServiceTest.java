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

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;

@ExtendWith(MockitoExtension.class)
class EnvironmentServiceTest {

	@Mock
	EnvironmentRepository environmentRepository;

	EnvironmentService environmentService;

	@BeforeEach
	void setUp() {
		this.environmentService = new EnvironmentService(this.environmentRepository);
	}

	@Test
	void should_create_environment_when_name_is_unique() {
		// given
		given(this.environmentRepository.existsByName("staging")).willReturn(false);
		given(this.environmentRepository.save(any(Environment.class)))
			.willAnswer(invocation -> invocation.getArgument(0));

		// when
		Environment result = this.environmentService.create("staging", "Pre-production", 2, false);

		// then
		assertThat(result.getName()).isEqualTo("staging");
		assertThat(result.getDescription()).isEqualTo("Pre-production");
		assertThat(result.getDisplayOrder()).isEqualTo(2);
		assertThat(result.isProduction()).isFalse();
		assertThat(result.getCreatedAt()).isNotNull();
		assertThat(result.getUpdatedAt()).isNotNull();
		then(this.environmentRepository).should().save(any(Environment.class));
	}

	@Test
	void should_throw_when_name_already_exists() {
		// given
		given(this.environmentRepository.existsByName("staging")).willReturn(true);

		// when/then
		assertThatThrownBy(() -> this.environmentService.create("staging", null, 0, false))
			.isInstanceOf(EnvironmentAlreadyExistsException.class);
	}

	@Test
	void should_find_environment_by_name() {
		// given
		Environment env = Environment.create("staging", "Pre-production", 2, false);
		given(this.environmentRepository.findByName("staging")).willReturn(Optional.of(env));

		// when
		Environment result = this.environmentService.findByName("staging");

		// then
		assertThat(result.getName()).isEqualTo("staging");
		assertThat(result.getDescription()).isEqualTo("Pre-production");
	}

	@Test
	void should_throw_when_environment_not_found() {
		// given
		given(this.environmentRepository.findByName("unknown")).willReturn(Optional.empty());

		// when/then
		assertThatThrownBy(() -> this.environmentService.findByName("unknown"))
			.isInstanceOf(EnvironmentNotFoundException.class);
	}

	@Test
	void should_list_all_environments_ordered() {
		// given
		Environment dev = Environment.create("dev", "Development", 1, false);
		Environment prod = Environment.create("production", "Production", 3, true);
		given(this.environmentRepository.findAllByOrderByDisplayOrderAscNameAsc()).willReturn(List.of(dev, prod));

		// when
		List<Environment> result = this.environmentService.findAll();

		// then
		assertThat(result).hasSize(2);
		assertThat(result.get(0).getName()).isEqualTo("dev");
		assertThat(result.get(1).getName()).isEqualTo("production");
	}

	@Test
	void should_update_environment() {
		// given
		Environment env = Environment.create("staging", "Old desc", 2, false);
		given(this.environmentRepository.findByName("staging")).willReturn(Optional.of(env));
		given(this.environmentRepository.save(any(Environment.class)))
			.willAnswer(invocation -> invocation.getArgument(0));

		// when
		Environment result = this.environmentService.update("staging", "New desc", 5, true);

		// then
		assertThat(result.getDescription()).isEqualTo("New desc");
		assertThat(result.getDisplayOrder()).isEqualTo(5);
		assertThat(result.isProduction()).isTrue();
	}

	@Test
	void should_delete_environment_by_name() {
		// given
		Environment env = Environment.create("staging", null, 0, false);
		given(this.environmentRepository.findByName("staging")).willReturn(Optional.of(env));

		// when
		this.environmentService.deleteByName("staging");

		// then
		then(this.environmentRepository).should().delete(env);
	}

	@Test
	void should_ensure_exists_creates_when_absent() {
		// given
		given(this.environmentRepository.existsByName("canary")).willReturn(false);
		given(this.environmentRepository.save(any(Environment.class)))
			.willAnswer(invocation -> invocation.getArgument(0));

		// when
		this.environmentService.ensureExists("canary");

		// then
		then(this.environmentRepository).should().save(any(Environment.class));
	}

	@Test
	void should_ensure_exists_does_nothing_when_present() {
		// given
		given(this.environmentRepository.existsByName("staging")).willReturn(true);

		// when
		this.environmentService.ensureExists("staging");

		// then
		then(this.environmentRepository).shouldHaveNoMoreInteractions();
	}

}
