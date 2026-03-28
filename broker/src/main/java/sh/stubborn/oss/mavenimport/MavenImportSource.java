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
package sh.stubborn.oss.mavenimport;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import org.jspecify.annotations.Nullable;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import org.hibernate.envers.Audited;
import org.hibernate.envers.AuditTable;

@Entity
@Table(name = "maven_import_sources")
@Audited
@AuditTable("maven_import_sources_aud")
class MavenImportSource {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(name = "repository_url", nullable = false, length = 2048)
	private String repositoryUrl;

	@Column(name = "group_id", nullable = false)
	private String groupId;

	@Column(name = "artifact_id", nullable = false)
	private String artifactId;

	@Column
	private String username;

	@Column(name = "encrypted_password", columnDefinition = "TEXT")
	private String encryptedPassword;

	@Column(name = "sync_enabled", nullable = false)
	private boolean syncEnabled;

	@Column(name = "last_sync_at")
	private Instant lastSyncAt;

	@Column(name = "last_synced_version", length = 128)
	private String lastSyncedVersion;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	@Version
	@Column(name = "row_version")
	private Long rowVersion;

	protected MavenImportSource() {
	}

	private MavenImportSource(String repositoryUrl, String groupId, String artifactId, @Nullable String username,
			@Nullable String encryptedPassword, boolean syncEnabled) {
		this.repositoryUrl = repositoryUrl;
		this.groupId = groupId;
		this.artifactId = artifactId;
		this.username = username;
		this.encryptedPassword = encryptedPassword;
		this.syncEnabled = syncEnabled;
		this.createdAt = Instant.now();
		this.updatedAt = this.createdAt;
	}

	static MavenImportSource create(String repositoryUrl, String groupId, String artifactId, @Nullable String username,
			@Nullable String encryptedPassword, boolean syncEnabled) {
		return new MavenImportSource(repositoryUrl, groupId, artifactId, username, encryptedPassword, syncEnabled);
	}

	UUID getId() {
		return this.id;
	}

	String getRepositoryUrl() {
		return this.repositoryUrl;
	}

	String getGroupId() {
		return this.groupId;
	}

	String getArtifactId() {
		return this.artifactId;
	}

	String getUsername() {
		return this.username;
	}

	String getEncryptedPassword() {
		return this.encryptedPassword;
	}

	boolean isSyncEnabled() {
		return this.syncEnabled;
	}

	Instant getLastSyncAt() {
		return this.lastSyncAt;
	}

	String getLastSyncedVersion() {
		return this.lastSyncedVersion;
	}

	Instant getCreatedAt() {
		return this.createdAt;
	}

	Instant getUpdatedAt() {
		return this.updatedAt;
	}

	void markSynced(String version) {
		this.lastSyncAt = Instant.now();
		this.lastSyncedVersion = version;
		this.updatedAt = Instant.now();
	}

}
