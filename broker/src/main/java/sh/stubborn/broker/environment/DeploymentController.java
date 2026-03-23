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
package sh.stubborn.broker.environment;

import java.net.URI;

import jakarta.validation.Valid;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/environments/{env}/deployments")
class DeploymentController {

	private final DeploymentService deploymentService;

	DeploymentController(DeploymentService deploymentService) {
		this.deploymentService = deploymentService;
	}

	@PostMapping
	ResponseEntity<DeploymentResponse> recordDeployment(@PathVariable String env,
			@Valid @RequestBody CreateDeploymentRequest request) {
		Deployment deployment = this.deploymentService.recordDeployment(env, request.applicationName(),
				request.version());
		DeploymentResponse response = DeploymentResponse.from(deployment, request.applicationName());
		URI location = URI.create("/api/v1/environments/" + env + "/deployments/" + request.applicationName());
		return ResponseEntity.created(location).body(response);
	}

	@GetMapping
	ResponseEntity<Page<DeploymentResponse>> list(@PathVariable String env, Pageable pageable) {
		Page<DeploymentResponse> page = this.deploymentService.findResponsesByEnvironment(env, pageable);
		return ResponseEntity.ok(page);
	}

	@GetMapping("/{applicationName}")
	ResponseEntity<DeploymentResponse> getByApplication(@PathVariable String env,
			@PathVariable String applicationName) {
		Deployment deployment = this.deploymentService.findByEnvironmentAndApplication(env, applicationName);
		return ResponseEntity.ok(DeploymentResponse.from(deployment, applicationName));
	}

}
