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
package sh.stubborn.oss.contract;

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
@Table(name = "contracts")
@Audited
@AuditTable("contracts_aud")
class Contract {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(name = "application_id", nullable = false)
	private UUID applicationId;

	@Column(nullable = false, length = 64)
	private String version;

	@Column(name = "contract_name", nullable = false, length = 256)
	private String contractName;

	@Column(nullable = false, columnDefinition = "TEXT")
	private String content;

	@Column(name = "content_type", nullable = false, length = 100)
	private String contentType;

	@Column(length = 128)
	private String branch;

	@Column(name = "content_hash", length = 64)
	private String contentHash;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	@Version
	@Column(name = "row_version")
	private Long rowVersion;

	protected Contract() {
	}

	private Contract(UUID applicationId, String version, String contractName, String content, String contentType,
			@Nullable String branch, @Nullable String contentHash) {
		ContractVersion.of(version);
		if (branch != null) {
			BranchName.of(branch);
		}
		this.applicationId = applicationId;
		this.version = version;
		this.contractName = contractName;
		this.content = content;
		this.contentType = contentType;
		this.branch = branch;
		this.contentHash = contentHash;
		this.createdAt = Instant.now();
		this.updatedAt = this.createdAt;
	}

	static Contract create(UUID applicationId, String version, String contractName, String content, String contentType,
			@Nullable String branch, @Nullable String contentHash) {
		return new Contract(applicationId, version, contractName, content, contentType, branch, contentHash);
	}

	static Contract create(UUID applicationId, String version, String contractName, String content,
			String contentType) {
		return create(applicationId, version, contractName, content, contentType, null, null);
	}

	UUID getId() {
		return this.id;
	}

	UUID getApplicationId() {
		return this.applicationId;
	}

	String getVersion() {
		return this.version;
	}

	String getContractName() {
		return this.contractName;
	}

	String getContent() {
		return this.content;
	}

	String getContentType() {
		return this.contentType;
	}

	String getBranch() {
		return this.branch;
	}

	String getContentHash() {
		return this.contentHash;
	}

	Instant getCreatedAt() {
		return this.createdAt;
	}

	Instant getUpdatedAt() {
		return this.updatedAt;
	}

}
