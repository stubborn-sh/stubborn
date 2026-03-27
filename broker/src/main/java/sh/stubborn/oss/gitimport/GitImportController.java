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
package sh.stubborn.oss.gitimport;

import java.net.URI;
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
class GitImportController {

	private final GitImportService importService;

	GitImportController(GitImportService importService) {
		this.importService = importService;
	}

	@PostMapping("/git")
	ResponseEntity<GitImportResultResponse> importFromGit(@Valid @RequestBody ImportGitRequest request) {
		GitImportService.GitImportResult result = this.importService.importFromGit(request.applicationName(),
				request.repositoryUrl(), request.branch(), request.contractsDirectory(), request.version(),
				request.authType(), request.username(), request.token());
		return ResponseEntity.ok(GitImportResultResponse.from(result));
	}

	@GetMapping("/git-sources")
	ResponseEntity<Page<GitImportSourceResponse>> listSources(Pageable pageable) {
		Page<GitImportSourceResponse> page = this.importService.listSources(pageable)
			.map(GitImportSourceResponse::from);
		return ResponseEntity.ok(page);
	}

	@PostMapping("/git-sources")
	ResponseEntity<GitImportSourceResponse> registerSource(@Valid @RequestBody RegisterGitSourceRequest request) {
		GitImportSource source = this.importService.registerSource(request.applicationName(), request.repositoryUrl(),
				request.branch(), request.contractsDirectory(), request.authType(), request.username(),
				request.encryptedToken(), request.syncEnabled());
		GitImportSourceResponse response = GitImportSourceResponse.from(source);
		URI location = URI.create("/api/v1/import/git-sources/" + source.getId());
		return ResponseEntity.created(location).body(response);
	}

	@GetMapping("/git-sources/{id}")
	ResponseEntity<GitImportSourceResponse> getSource(@PathVariable UUID id) {
		GitImportSource source = this.importService.getSource(id);
		return ResponseEntity.ok(GitImportSourceResponse.from(source));
	}

	@DeleteMapping("/git-sources/{id}")
	ResponseEntity<Void> deleteSource(@PathVariable UUID id) {
		this.importService.deleteSource(id);
		return ResponseEntity.noContent().build();
	}

}
