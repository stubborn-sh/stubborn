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
package sh.stubborn.broker.tag;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

interface VersionTagRepository extends JpaRepository<VersionTag, UUID> {

	List<VersionTag> findByApplicationIdAndVersion(UUID applicationId, String version);

	List<VersionTag> findByApplicationIdAndTag(UUID applicationId, String tag);

	Optional<VersionTag> findByApplicationIdAndVersionAndTag(UUID applicationId, String version, String tag);

	boolean existsByApplicationIdAndVersionAndTag(UUID applicationId, String version, String tag);

	void deleteByApplicationIdAndVersionAndTag(UUID applicationId, String version, String tag);

	@Query("""
			SELECT vt FROM VersionTag vt WHERE vt.applicationId = :applicationId AND vt.tag = :tag
			ORDER BY vt.createdAt DESC LIMIT 1
			""")
	Optional<VersionTag> findLatestByApplicationIdAndTag(UUID applicationId, String tag);

}
