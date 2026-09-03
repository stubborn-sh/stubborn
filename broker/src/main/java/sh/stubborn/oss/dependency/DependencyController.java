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
package sh.stubborn.oss.dependency;

import java.util.List;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Lets a consumer state which providers it depends on. The path identifies the consumer,
 * mirroring the contract-publishing endpoint, because in this broker the provider
 * publishes contracts and so cannot name its own consumers.
 */
@RestController
@RequestMapping("/api/v1/applications/{name}/versions/{version}/dependencies")
class DependencyController {

	private final DependencyService dependencyService;

	DependencyController(DependencyService dependencyService) {
		this.dependencyService = dependencyService;
	}

	@PostMapping
	ResponseEntity<DependencyResponse> declare(@PathVariable String name, @PathVariable String version,
			@Valid @RequestBody DeclareDependencyRequest request) {
		DependencyInfo info = this.dependencyService.declare(name, version, request.provider(),
				DependencySource.DECLARED);
		return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(info));
	}

	@GetMapping
	ResponseEntity<List<DependencyResponse>> list(@PathVariable String name, @PathVariable String version) {
		return ResponseEntity
			.ok(this.dependencyService.findInfoByConsumer(name, version).stream().map(this::toResponse).toList());
	}

	private DependencyResponse toResponse(DependencyInfo info) {
		return new DependencyResponse(this.dependencyService.resolveApplicationName(info.consumerId()),
				info.consumerVersion(), this.dependencyService.resolveApplicationName(info.providerId()), info.source(),
				info.declaredAt());
	}

}
