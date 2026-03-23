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
package sh.stubborn.broker.application;

import java.net.URI;
import java.util.List;

import jakarta.validation.Valid;
import org.jspecify.annotations.Nullable;

import sh.stubborn.broker.contract.ContractService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/applications")
class ApplicationController {

	private final ApplicationService applicationService;

	private final ContractService contractService;

	ApplicationController(ApplicationService applicationService, ContractService contractService) {
		this.applicationService = applicationService;
		this.contractService = contractService;
	}

	@PostMapping
	ResponseEntity<ApplicationResponse> register(@Valid @RequestBody CreateApplicationRequest request) {
		Application app = this.applicationService.register(request.name(), request.description(), request.owner(),
				request.mainBranch());
		ApplicationResponse response = ApplicationResponse.from(app);
		return ResponseEntity.created(URI.create("/api/v1/applications/" + app.getName())).body(response);
	}

	@PutMapping("/{name}")
	ResponseEntity<ApplicationResponse> update(@PathVariable String name,
			@Valid @RequestBody UpdateApplicationRequest request) {
		Application app = this.applicationService.updateMainBranch(name, request.mainBranch());
		return ResponseEntity.ok(ApplicationResponse.from(app));
	}

	@GetMapping
	ResponseEntity<Page<ApplicationResponse>> list(@Nullable @RequestParam(required = false) String search,
			Pageable pageable) {
		Page<ApplicationResponse> page = this.applicationService.findAll(search, pageable)
			.map(ApplicationResponse::from);
		return ResponseEntity.ok(page);
	}

	@GetMapping("/{name}")
	ResponseEntity<ApplicationResponse> getByName(@PathVariable String name) {
		Application app = this.applicationService.findByName(name);
		return ResponseEntity.ok(ApplicationResponse.from(app));
	}

	@GetMapping("/{name}/versions")
	ResponseEntity<List<String>> listVersions(@PathVariable String name) {
		List<String> versions = this.contractService.findVersionsByApplicationName(name);
		return ResponseEntity.ok(versions);
	}

	@DeleteMapping("/{name}")
	ResponseEntity<Void> deleteByName(@PathVariable String name) {
		this.applicationService.deleteByName(name);
		return ResponseEntity.noContent().build();
	}

}
