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
package org.springframework.cloud.contract.broker.tag;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.cloud.contract.broker.application.ApplicationService;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;

@ExtendWith(MockitoExtension.class)
class TagServiceTest {

	@Mock
	VersionTagRepository versionTagRepository;

	@Mock
	ApplicationService applicationService;

	TagService tagService;

	private final UUID appId = UUID.randomUUID();

	@BeforeEach
	void setUp() {
		this.tagService = new TagService(this.versionTagRepository, this.applicationService);
	}

	@Test
	void should_add_tag_to_version() {
		// given
		given(this.applicationService.findIdByName("order-service")).willReturn(this.appId);
		given(this.versionTagRepository.existsByApplicationIdAndVersionAndTag(this.appId, "1.0.0", "prod"))
			.willReturn(false);
		VersionTag tag = VersionTag.create(this.appId, "1.0.0", "prod");
		given(this.versionTagRepository.save(any(VersionTag.class))).willReturn(tag);

		// when
		VersionTag result = this.tagService.addTag("order-service", "1.0.0", "prod");

		// then
		assertThat(result.getTag()).isEqualTo("prod");
		assertThat(result.getVersion()).isEqualTo("1.0.0");
	}

	@Test
	void should_return_existing_tag_when_already_exists() {
		// given
		given(this.applicationService.findIdByName("order-service")).willReturn(this.appId);
		given(this.versionTagRepository.existsByApplicationIdAndVersionAndTag(this.appId, "1.0.0", "prod"))
			.willReturn(true);
		VersionTag existing = VersionTag.create(this.appId, "1.0.0", "prod");
		given(this.versionTagRepository.findByApplicationIdAndVersionAndTag(this.appId, "1.0.0", "prod"))
			.willReturn(Optional.of(existing));

		// when
		VersionTag result = this.tagService.addTag("order-service", "1.0.0", "prod");

		// then
		assertThat(result.getTag()).isEqualTo("prod");
		then(this.versionTagRepository).should().findByApplicationIdAndVersionAndTag(this.appId, "1.0.0", "prod");
	}

	@Test
	void should_remove_tag() {
		// given
		given(this.applicationService.findIdByName("order-service")).willReturn(this.appId);

		// when
		this.tagService.removeTag("order-service", "1.0.0", "prod");

		// then
		then(this.versionTagRepository).should().deleteByApplicationIdAndVersionAndTag(this.appId, "1.0.0", "prod");
	}

	@Test
	void should_find_tags_by_version() {
		// given
		given(this.applicationService.findIdByName("order-service")).willReturn(this.appId);
		VersionTag tag = VersionTag.create(this.appId, "1.0.0", "prod");
		given(this.versionTagRepository.findByApplicationIdAndVersion(this.appId, "1.0.0")).willReturn(List.of(tag));

		// when
		List<VersionTag> result = this.tagService.findTagsByVersion("order-service", "1.0.0");

		// then
		assertThat(result).hasSize(1);
		assertThat(result.get(0).getTag()).isEqualTo("prod");
	}

	@Test
	void should_find_latest_version_by_tag() {
		// given
		given(this.applicationService.findIdByName("order-service")).willReturn(this.appId);
		VersionTag tag = VersionTag.create(this.appId, "2.0.0", "prod");
		given(this.versionTagRepository.findLatestByApplicationIdAndTag(this.appId, "prod"))
			.willReturn(Optional.of(tag));

		// when
		String version = this.tagService.findLatestVersionByTag("order-service", "prod");

		// then
		assertThat(version).isEqualTo("2.0.0");
	}

	@Test
	void should_throw_when_tag_not_found() {
		// given
		given(this.applicationService.findIdByName("order-service")).willReturn(this.appId);
		given(this.versionTagRepository.findLatestByApplicationIdAndTag(this.appId, "unknown"))
			.willReturn(Optional.empty());

		// when/then
		assertThatThrownBy(() -> this.tagService.findLatestVersionByTag("order-service", "unknown"))
			.isInstanceOf(TagNotFoundException.class);
	}

	@Test
	void should_count_tags() {
		// given
		given(this.versionTagRepository.count()).willReturn(42L);

		// when
		long count = this.tagService.count();

		// then
		assertThat(count).isEqualTo(42L);
	}

}
