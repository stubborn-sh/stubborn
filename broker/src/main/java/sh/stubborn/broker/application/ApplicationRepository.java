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

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ApplicationRepository extends JpaRepository<Application, UUID> {

	Optional<Application> findByName(String name);

	boolean existsByName(String name);

	void deleteByName(String name);

	@Query("SELECT a FROM Application a WHERE LOWER(a.name) LIKE LOWER(CONCAT('%', :search, '%'))"
			+ " OR LOWER(a.owner) LIKE LOWER(CONCAT('%', :search, '%'))")
	Page<Application> searchByNameOrOwner(@Param("search") String search, Pageable pageable);

}
