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
package org.springframework.cloud.contract.broker.mavenimport;

import java.time.Instant;
import java.util.UUID;

record MavenImportSourceResponse(UUID id, String repositoryUrl, String groupId, String artifactId, boolean syncEnabled,
		Instant lastSyncAt, String lastSyncedVersion, Instant createdAt, Instant updatedAt) {

	static MavenImportSourceResponse from(MavenImportSource source) {
		return new MavenImportSourceResponse(source.getId(), source.getRepositoryUrl(), source.getGroupId(),
				source.getArtifactId(), source.isSyncEnabled(), source.getLastSyncAt(), source.getLastSyncedVersion(),
				source.getCreatedAt(), source.getUpdatedAt());
	}

}
