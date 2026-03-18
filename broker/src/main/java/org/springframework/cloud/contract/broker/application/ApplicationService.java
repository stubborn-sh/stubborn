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

import org.jspecify.annotations.Nullable;

import java.util.List;
import java.util.UUID;

import io.micrometer.observation.annotation.Observed;

import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ApplicationService {

	private final ApplicationRepository repository;

	ApplicationService(ApplicationRepository repository) {
		this.repository = repository;
	}

	@Observed(name = "broker.application.register")
	@Transactional
	@CacheEvict(cacheNames = "applications", allEntries = true)
	public Application register(String name, @Nullable String description, String owner, @Nullable String mainBranch) {
		if (this.repository.existsByName(name)) {
			throw new ApplicationAlreadyExistsException(name);
		}
		Application application = Application.create(name, description, owner, mainBranch);
		return this.repository.save(application);
	}

	public Application register(String name, @Nullable String description, String owner) {
		return register(name, description, owner, null);
	}

	@Transactional
	@CacheEvict(cacheNames = "applications", allEntries = true)
	public Application updateMainBranch(String name, String mainBranch) {
		Application application = findByName(name);
		application.updateMainBranch(mainBranch);
		return this.repository.save(application);
	}

	public String findMainBranchByName(String name) {
		return findByName(name).getMainBranch();
	}

	@Cacheable(cacheNames = "applications", key = "'byName:' + #name")
	public Application findByName(String name) {
		return this.repository.findByName(name).orElseThrow(() -> new ApplicationNotFoundException(name));
	}

	public Page<Application> findAll(@Nullable String search, Pageable pageable) {
		if (search != null && !search.isBlank()) {
			return this.repository.searchByNameOrOwner(search.strip(), pageable);
		}
		return this.repository.findAll(pageable);
	}

	public UUID findIdByName(String name) {
		return findByName(name).getId();
	}

	public String findNameById(UUID id) {
		return this.repository.findById(id)
			.orElseThrow(() -> new ApplicationNotFoundException(id.toString()))
			.getName();
	}

	public String findOwnerById(UUID id) {
		return this.repository.findById(id)
			.orElseThrow(() -> new ApplicationNotFoundException(id.toString()))
			.getOwner();
	}

	@Cacheable(cacheNames = "applications", key = "'allInfo'")
	public List<ApplicationInfo> findAllInfo() {
		return this.repository.findAll().stream().map(ApplicationInfo::from).toList();
	}

	@Cacheable(cacheNames = "applications", key = "'count'")
	public long count() {
		return this.repository.count();
	}

	@Transactional
	@CacheEvict(cacheNames = "applications", allEntries = true)
	public void deleteByName(String name) {
		Application application = findByName(name);
		this.repository.delete(application);
	}

}
