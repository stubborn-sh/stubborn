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
package sh.stubborn.oss.mavenimport;

import java.net.URI;
import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/import")
class MavenImportController {

	private final MavenImportService importService;

	private final MavenStubsDiscoveryService discoveryService;

	MavenImportController(MavenImportService importService, MavenStubsDiscoveryService discoveryService) {
		this.importService = importService;
		this.discoveryService = discoveryService;
	}

	@PostMapping("/maven-discover")
	ResponseEntity<DiscoverStubsResponse> discoverStubs(@Valid @RequestBody DiscoverStubsRequest request) {
		List<DiscoveredStub> stubs = this.discoveryService.discover(request.repositoryUrl(), request.repositoryType(),
				request.username(), request.password());
		return ResponseEntity.ok(new DiscoverStubsResponse(stubs));
	}

	@PostMapping("/maven-jar")
	ResponseEntity<MavenImportResultResponse> importJar(@Valid @RequestBody ImportJarRequest request) {
		MavenImportService.MavenImportResult result = this.importService.importJar(request.applicationName(),
				request.repositoryUrl(), request.groupId(), request.artifactId(), request.version(), request.username(),
				request.password());
		return ResponseEntity.ok(MavenImportResultResponse.from(result));
	}

	@GetMapping("/sources")
	ResponseEntity<Page<MavenImportSourceResponse>> listSources(Pageable pageable) {
		Page<MavenImportSourceResponse> page = this.importService.listSources(pageable)
			.map(MavenImportSourceResponse::from);
		return ResponseEntity.ok(page);
	}

	@PostMapping("/sources")
	ResponseEntity<MavenImportSourceResponse> registerSource(@Valid @RequestBody RegisterSourceRequest request) {
		MavenImportSource source = this.importService.registerSource(request.repositoryUrl(), request.groupId(),
				request.artifactId(), request.username(), request.encryptedPassword(), request.syncEnabled());
		MavenImportSourceResponse response = MavenImportSourceResponse.from(source);
		URI location = URI.create("/api/v1/import/sources/" + source.getId());
		return ResponseEntity.created(location).body(response);
	}

	@GetMapping("/sources/{id}")
	ResponseEntity<MavenImportSourceResponse> getSource(@PathVariable UUID id) {
		MavenImportSource source = this.importService.getSource(id);
		return ResponseEntity.ok(MavenImportSourceResponse.from(source));
	}

	@DeleteMapping("/sources/{id}")
	ResponseEntity<Void> deleteSource(@PathVariable UUID id) {
		this.importService.deleteSource(id);
		return ResponseEntity.noContent().build();
	}

}
