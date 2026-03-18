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

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class ApplicationServiceTest {

	@Mock
	ApplicationRepository repository;

	ApplicationService service;

	@BeforeEach
	void setUp() {
		this.service = new ApplicationService(this.repository);
	}

	@Test
	void should_register_application_when_name_is_unique() {
		// given
		given(this.repository.existsByName("order-service")).willReturn(false);
		given(this.repository.save(any(Application.class))).willAnswer(invocation -> invocation.getArgument(0));

		// when
		Application result = this.service.register("order-service", "Manages orders", "team-commerce");

		// then
		assertThat(result.getName()).isEqualTo("order-service");
		assertThat(result.getDescription()).isEqualTo("Manages orders");
		assertThat(result.getOwner()).isEqualTo("team-commerce");
		verify(this.repository).save(any(Application.class));
	}

	@Test
	void should_throw_when_name_already_exists() {
		// given
		given(this.repository.existsByName("order-service")).willReturn(true);

		// then
		assertThatThrownBy(() -> this.service.register("order-service", "desc", "owner"))
			.isInstanceOf(ApplicationAlreadyExistsException.class)
			.hasMessageContaining("order-service");
	}

	@Test
	void should_find_application_by_name() {
		// given
		Application app = Application.create("order-service", "desc", "owner");
		given(this.repository.findByName("order-service")).willReturn(Optional.of(app));

		// when
		Application result = this.service.findByName("order-service");

		// then
		assertThat(result.getName()).isEqualTo("order-service");
	}

	@Test
	void should_throw_when_application_not_found() {
		// given
		given(this.repository.findByName("nonexistent")).willReturn(Optional.empty());

		// then
		assertThatThrownBy(() -> this.service.findByName("nonexistent"))
			.isInstanceOf(ApplicationNotFoundException.class)
			.hasMessageContaining("nonexistent");
	}

	@Test
	void should_delete_application_by_name() {
		// given
		Application app = Application.create("order-service", "desc", "owner");
		given(this.repository.findByName("order-service")).willReturn(Optional.of(app));

		// when
		this.service.deleteByName("order-service");

		// then
		verify(this.repository).delete(app);
	}

	@Test
	void should_register_application_with_custom_main_branch() {
		// given
		given(this.repository.existsByName("order-service")).willReturn(false);
		given(this.repository.save(any(Application.class))).willAnswer(invocation -> invocation.getArgument(0));

		// when
		Application result = this.service.register("order-service", "Manages orders", "team-commerce", "develop");

		// then
		assertThat(result.getMainBranch()).isEqualTo("develop");
	}

	@Test
	void should_default_main_branch_to_main() {
		// given
		given(this.repository.existsByName("order-service")).willReturn(false);
		given(this.repository.save(any(Application.class))).willAnswer(invocation -> invocation.getArgument(0));

		// when
		Application result = this.service.register("order-service", "desc", "owner");

		// then
		assertThat(result.getMainBranch()).isEqualTo("main");
	}

	@Test
	void should_update_main_branch() {
		// given
		Application app = Application.create("order-service", "desc", "owner");
		given(this.repository.findByName("order-service")).willReturn(Optional.of(app));
		given(this.repository.save(any(Application.class))).willAnswer(invocation -> invocation.getArgument(0));

		// when
		Application result = this.service.updateMainBranch("order-service", "develop");

		// then
		assertThat(result.getMainBranch()).isEqualTo("develop");
	}

	@Test
	void should_throw_when_updating_nonexistent_application_branch() {
		// given
		given(this.repository.findByName("nonexistent")).willReturn(Optional.empty());

		// then
		assertThatThrownBy(() -> this.service.updateMainBranch("nonexistent", "develop"))
			.isInstanceOf(ApplicationNotFoundException.class);
	}

	@Test
	void should_throw_when_deleting_nonexistent_application() {
		// given
		given(this.repository.findByName("nonexistent")).willReturn(Optional.empty());

		// then
		assertThatThrownBy(() -> this.service.deleteByName("nonexistent"))
			.isInstanceOf(ApplicationNotFoundException.class);
	}

	@Test
	void should_find_id_by_name() {
		// given
		Application app = Application.create("order-service", "desc", "owner");
		given(this.repository.findByName("order-service")).willReturn(Optional.of(app));

		// when
		UUID id = this.service.findIdByName("order-service");

		// then
		assertThat(id).isEqualTo(app.getId());
	}

	@Test
	void should_find_name_by_id() {
		// given
		Application app = Application.create("order-service", "desc", "owner");
		given(this.repository.findById(app.getId())).willReturn(Optional.of(app));

		// when
		String name = this.service.findNameById(app.getId());

		// then
		assertThat(name).isEqualTo("order-service");
	}

	@Test
	void should_throw_when_name_not_found_by_id() {
		// given
		UUID id = UUID.randomUUID();
		given(this.repository.findById(id)).willReturn(Optional.empty());

		// then
		assertThatThrownBy(() -> this.service.findNameById(id)).isInstanceOf(ApplicationNotFoundException.class);
	}

	@Test
	void should_find_owner_by_id() {
		// given
		Application app = Application.create("order-service", "desc", "team-commerce");
		given(this.repository.findById(app.getId())).willReturn(Optional.of(app));

		// when
		String owner = this.service.findOwnerById(app.getId());

		// then
		assertThat(owner).isEqualTo("team-commerce");
	}

	@Test
	void should_throw_when_owner_not_found_by_id() {
		// given
		UUID id = UUID.randomUUID();
		given(this.repository.findById(id)).willReturn(Optional.empty());

		// then
		assertThatThrownBy(() -> this.service.findOwnerById(id)).isInstanceOf(ApplicationNotFoundException.class);
	}

	@Test
	void should_find_all_paginated() {
		// given
		Application app = Application.create("order-service", "desc", "owner");
		Page<Application> page = new PageImpl<>(List.of(app));
		given(this.repository.findAll(any(PageRequest.class))).willReturn(page);

		// when
		Page<Application> result = this.service.findAll(null, PageRequest.of(0, 10));

		// then
		assertThat(result.getContent()).hasSize(1);
		assertThat(result.getContent().get(0).getName()).isEqualTo("order-service");
	}

	@Test
	void should_search_by_name_or_owner() {
		// given
		Application app = Application.create("order-service", "desc", "team-commerce");
		Page<Application> page = new PageImpl<>(List.of(app));
		given(this.repository.searchByNameOrOwner("order", PageRequest.of(0, 10))).willReturn(page);

		// when
		Page<Application> result = this.service.findAll("order", PageRequest.of(0, 10));

		// then
		assertThat(result.getContent()).hasSize(1);
		assertThat(result.getContent().get(0).getName()).isEqualTo("order-service");
	}

	@Test
	void should_return_all_when_search_is_blank() {
		// given
		Application app = Application.create("order-service", "desc", "owner");
		Page<Application> page = new PageImpl<>(List.of(app));
		given(this.repository.findAll(any(PageRequest.class))).willReturn(page);

		// when
		Page<Application> result = this.service.findAll("   ", PageRequest.of(0, 10));

		// then
		assertThat(result.getContent()).hasSize(1);
	}

	@Test
	void should_find_all_info() {
		// given
		Application app = Application.create("order-service", "desc", "owner");
		given(this.repository.findAll()).willReturn(List.of(app));

		// when
		List<ApplicationInfo> result = this.service.findAllInfo();

		// then
		assertThat(result).hasSize(1);
		assertThat(result.get(0).name()).isEqualTo("order-service");
	}

	@Test
	void should_count_applications() {
		// given
		given(this.repository.count()).willReturn(5L);

		// when
		long count = this.service.count();

		// then
		assertThat(count).isEqualTo(5);
	}

	@Test
	void should_find_main_branch_by_name() {
		// given
		Application app = Application.create("order-service", "desc", "owner", "develop");
		given(this.repository.findByName("order-service")).willReturn(Optional.of(app));

		// when
		String mainBranch = this.service.findMainBranchByName("order-service");

		// then
		assertThat(mainBranch).isEqualTo("develop");
	}

}
