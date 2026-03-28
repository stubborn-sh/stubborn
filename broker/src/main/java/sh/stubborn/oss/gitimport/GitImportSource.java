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
package sh.stubborn.oss.gitimport;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import org.hibernate.envers.Audited;
import org.hibernate.envers.AuditTable;
import org.jspecify.annotations.Nullable;

@Entity
@Table(name = "git_import_sources")
@Audited
@AuditTable("git_import_sources_aud")
class GitImportSource {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(name = "application_name", nullable = false)
	private String applicationName;

	@Column(name = "repository_url", nullable = false, length = 2048)
	private String repositoryUrl;

	@Column(nullable = false)
	private String branch;

	@Column(name = "contracts_directory", nullable = false, length = 1024)
	private String contractsDirectory;

	@Column(name = "auth_type", length = 32)
	private String authType;

	@Column
	private String username;

	@Column(name = "encrypted_token", columnDefinition = "TEXT")
	private String encryptedToken;

	@Column(name = "sync_enabled", nullable = false)
	private boolean syncEnabled;

	@Column(name = "last_sync_at")
	private Instant lastSyncAt;

	@Column(name = "last_synced_commit", length = 64)
	private String lastSyncedCommit;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	@Version
	@Column(name = "row_version")
	private Long rowVersion;

	protected GitImportSource() {
	}

	private GitImportSource(String applicationName, String repositoryUrl, String branch, String contractsDirectory,
			String authType, @Nullable String username, @Nullable String encryptedToken, boolean syncEnabled) {
		this.applicationName = applicationName;
		this.repositoryUrl = repositoryUrl;
		this.branch = branch;
		this.contractsDirectory = contractsDirectory;
		this.authType = authType;
		this.username = username;
		this.encryptedToken = encryptedToken;
		this.syncEnabled = syncEnabled;
		this.createdAt = Instant.now();
		this.updatedAt = this.createdAt;
	}

	static GitImportSource create(String applicationName, String repositoryUrl, String branch,
			String contractsDirectory, String authType, @Nullable String username, @Nullable String encryptedToken,
			boolean syncEnabled) {
		return new GitImportSource(applicationName, repositoryUrl, branch, contractsDirectory, authType, username,
				encryptedToken, syncEnabled);
	}

	UUID getId() {
		return this.id;
	}

	String getApplicationName() {
		return this.applicationName;
	}

	String getRepositoryUrl() {
		return this.repositoryUrl;
	}

	String getBranch() {
		return this.branch;
	}

	String getContractsDirectory() {
		return this.contractsDirectory;
	}

	String getAuthType() {
		return this.authType;
	}

	String getUsername() {
		return this.username;
	}

	String getEncryptedToken() {
		return this.encryptedToken;
	}

	boolean isSyncEnabled() {
		return this.syncEnabled;
	}

	Instant getLastSyncAt() {
		return this.lastSyncAt;
	}

	String getLastSyncedCommit() {
		return this.lastSyncedCommit;
	}

	Instant getCreatedAt() {
		return this.createdAt;
	}

	Instant getUpdatedAt() {
		return this.updatedAt;
	}

	void markSynced(String commitSha) {
		this.lastSyncAt = Instant.now();
		this.lastSyncedCommit = commitSha;
		this.updatedAt = Instant.now();
	}

}
