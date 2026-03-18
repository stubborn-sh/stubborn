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

import java.net.URI;
import java.util.List;

import jakarta.validation.Valid;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/environments")
class EnvironmentController {

	private final EnvironmentService environmentService;

	EnvironmentController(EnvironmentService environmentService) {
		this.environmentService = environmentService;
	}

	@PostMapping
	ResponseEntity<EnvironmentResponse> create(@Valid @RequestBody CreateEnvironmentRequest request) {
		Environment env = this.environmentService.create(request.name(), request.description(), request.displayOrder(),
				request.production());
		EnvironmentResponse response = EnvironmentResponse.from(env);
		return ResponseEntity.created(URI.create("/api/v1/environments/" + env.getName())).body(response);
	}

	@GetMapping
	ResponseEntity<List<EnvironmentResponse>> list() {
		List<EnvironmentResponse> environments = this.environmentService.findAll()
			.stream()
			.map(EnvironmentResponse::from)
			.toList();
		return ResponseEntity.ok(environments);
	}

	@GetMapping("/{name}")
	ResponseEntity<EnvironmentResponse> getByName(@PathVariable String name) {
		Environment env = this.environmentService.findByName(name);
		return ResponseEntity.ok(EnvironmentResponse.from(env));
	}

	@PutMapping("/{name}")
	ResponseEntity<EnvironmentResponse> update(@PathVariable String name,
			@Valid @RequestBody UpdateEnvironmentRequest request) {
		Environment env = this.environmentService.update(name, request.description(), request.displayOrder(),
				request.production());
		return ResponseEntity.ok(EnvironmentResponse.from(env));
	}

	@DeleteMapping("/{name}")
	ResponseEntity<Void> deleteByName(@PathVariable String name) {
		this.environmentService.deleteByName(name);
		return ResponseEntity.noContent().build();
	}

}
