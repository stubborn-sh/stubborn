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
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface DependencyRepository extends JpaRepository<Dependency, UUID> {

	Optional<Dependency> findByConsumerIdAndConsumerVersionAndProviderId(UUID consumerId, String consumerVersion,
			UUID providerId);

	List<Dependency> findByConsumerId(UUID consumerId);

	List<Dependency> findByConsumerIdAndConsumerVersion(UUID consumerId, String consumerVersion);

	@Query("SELECT DISTINCT d.consumerId FROM Dependency d WHERE d.providerId = :providerId")
	List<UUID> findDistinctConsumerIdsByProviderId(@Param("providerId") UUID providerId);

	@Query("SELECT DISTINCT d.providerId FROM Dependency d WHERE d.consumerId = :consumerId")
	List<UUID> findDistinctProviderIdsByConsumerId(@Param("consumerId") UUID consumerId);

}
