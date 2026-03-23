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

import java.util.List;
import java.util.UUID;

import io.micrometer.observation.annotation.Observed;

import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import sh.stubborn.broker.application.ApplicationService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TagService {

	private final VersionTagRepository versionTagRepository;

	private final ApplicationService applicationService;

	TagService(VersionTagRepository versionTagRepository, ApplicationService applicationService) {
		this.versionTagRepository = versionTagRepository;
		this.applicationService = applicationService;
	}

	@Observed(name = "broker.tag.add")
	@Transactional
	@CacheEvict(cacheNames = "tags", allEntries = true)
	public VersionTag addTag(String applicationName, String version, String tag) {
		UUID applicationId = this.applicationService.findIdByName(applicationName);
		if (this.versionTagRepository.existsByApplicationIdAndVersionAndTag(applicationId, version, tag)) {
			return this.versionTagRepository.findByApplicationIdAndVersionAndTag(applicationId, version, tag)
				.orElseThrow();
		}
		VersionTag versionTag = VersionTag.create(applicationId, version, tag);
		return this.versionTagRepository.save(versionTag);
	}

	@Transactional
	@CacheEvict(cacheNames = "tags", allEntries = true)
	public void removeTag(String applicationName, String version, String tag) {
		UUID applicationId = this.applicationService.findIdByName(applicationName);
		this.versionTagRepository.deleteByApplicationIdAndVersionAndTag(applicationId, version, tag);
	}

	public List<VersionTag> findTagsByVersion(String applicationName, String version) {
		UUID applicationId = this.applicationService.findIdByName(applicationName);
		return this.versionTagRepository.findByApplicationIdAndVersion(applicationId, version);
	}

	public String findLatestVersionByTag(String applicationName, String tag) {
		UUID applicationId = this.applicationService.findIdByName(applicationName);
		return this.versionTagRepository.findLatestByApplicationIdAndTag(applicationId, tag)
			.map(VersionTag::getVersion)
			.orElseThrow(() -> new TagNotFoundException(applicationName, tag));
	}

	@Cacheable(cacheNames = "tags", key = "'count'")
	public long count() {
		return this.versionTagRepository.count();
	}

}
