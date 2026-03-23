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

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface ContractRepository extends JpaRepository<Contract, UUID> {

	List<Contract> findByApplicationIdAndVersion(UUID applicationId, String version);

	Page<Contract> findByApplicationIdAndVersion(UUID applicationId, String version, Pageable pageable);

	@Query("SELECT DISTINCT c.version FROM Contract c WHERE c.applicationId = :appId ORDER BY c.version")
	List<String> findDistinctVersionsByApplicationId(@Param("appId") UUID appId);

	Optional<Contract> findByApplicationIdAndVersionAndContractName(UUID applicationId, String version,
			String contractName);

	boolean existsByApplicationIdAndVersionAndContractName(UUID applicationId, String version, String contractName);

	List<Contract> findByApplicationIdAndBranch(UUID applicationId, String branch);

	List<Contract> findByApplicationIdAndContentHash(UUID applicationId, String contentHash);

}
