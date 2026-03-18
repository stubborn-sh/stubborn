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

import org.jspecify.annotations.Nullable;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EnvironmentService {

	private final EnvironmentRepository environmentRepository;

	EnvironmentService(EnvironmentRepository environmentRepository) {
		this.environmentRepository = environmentRepository;
	}

	@Transactional
	public Environment create(String name, @Nullable String description, int displayOrder, boolean production) {
		EnvironmentName.of(name);
		if (this.environmentRepository.existsByName(name)) {
			throw new EnvironmentAlreadyExistsException(name);
		}
		Environment environment = Environment.create(name, description, displayOrder, production);
		return this.environmentRepository.save(environment);
	}

	public Environment findByName(String name) {
		return this.environmentRepository.findByName(name).orElseThrow(() -> new EnvironmentNotFoundException(name));
	}

	public List<Environment> findAll() {
		return this.environmentRepository.findAllByOrderByDisplayOrderAscNameAsc();
	}

	@Transactional
	public Environment update(String name, @Nullable String description, int displayOrder, boolean production) {
		Environment environment = findByName(name);
		environment.update(description, displayOrder, production);
		return this.environmentRepository.save(environment);
	}

	@Transactional
	public void deleteByName(String name) {
		Environment environment = findByName(name);
		this.environmentRepository.delete(environment);
	}

	@Transactional
	public void ensureExists(String name) {
		if (!this.environmentRepository.existsByName(name)) {
			Environment environment = Environment.create(name, null, 0, false);
			this.environmentRepository.save(environment);
		}
	}

}
