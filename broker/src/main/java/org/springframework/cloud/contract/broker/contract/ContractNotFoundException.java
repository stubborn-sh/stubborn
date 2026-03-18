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
package org.springframework.cloud.contract.broker.contract;

public class ContractNotFoundException extends RuntimeException {

	private final String contractName;

	public ContractNotFoundException(String applicationName, String version, String contractName) {
		super("Contract not found: " + contractName + " for application " + applicationName + " version " + version);
		this.contractName = contractName;
	}

	public String getContractName() {
		return this.contractName;
	}

}
