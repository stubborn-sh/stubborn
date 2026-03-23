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
package sh.stubborn.broker.contract;

import java.net.URI;

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
@RequestMapping("/api/v1/applications/{name}/versions/{version}/contracts")
class ContractController {

	private final ContractService contractService;

	ContractController(ContractService contractService) {
		this.contractService = contractService;
	}

	@PostMapping
	ResponseEntity<ContractResponse> publish(@PathVariable String name, @PathVariable String version,
			@Valid @RequestBody CreateContractRequest request) {
		Contract contract = this.contractService.publish(name, version, request.contractName(), request.content(),
				request.contentType(), request.branch());
		ContractResponse response = ContractResponse.from(contract);
		URI location = URI
			.create("/api/v1/applications/" + name + "/versions/" + version + "/contracts/" + request.contractName());
		return ResponseEntity.created(location).body(response);
	}

	@GetMapping
	ResponseEntity<Page<ContractResponse>> list(@PathVariable String name, @PathVariable String version,
			Pageable pageable) {
		Page<ContractResponse> page = this.contractService.findByApplicationAndVersion(name, version, pageable)
			.map(ContractResponse::from);
		return ResponseEntity.ok(page);
	}

	@GetMapping("/{contractName}")
	ResponseEntity<ContractResponse> getByName(@PathVariable String name, @PathVariable String version,
			@PathVariable String contractName) {
		Contract contract = this.contractService.findByApplicationAndVersionAndName(name, version, contractName);
		return ResponseEntity.ok(ContractResponse.from(contract));
	}

	@DeleteMapping("/{contractName}")
	ResponseEntity<Void> delete(@PathVariable String name, @PathVariable String version,
			@PathVariable String contractName) {
		this.contractService.delete(name, version, contractName);
		return ResponseEntity.noContent().build();
	}

}
