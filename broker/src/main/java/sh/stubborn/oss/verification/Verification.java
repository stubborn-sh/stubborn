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
package sh.stubborn.oss.verification;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import org.hibernate.envers.Audited;
import org.hibernate.envers.AuditTable;
import org.jspecify.annotations.Nullable;

@Entity
@Table(name = "verifications")
@Audited
@AuditTable("verifications_aud")
class Verification {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(name = "provider_id", nullable = false)
	private UUID providerId;

	@Column(name = "provider_version", nullable = false, length = 64)
	private String providerVersion;

	@Column(name = "consumer_id", nullable = false)
	private UUID consumerId;

	@Column(name = "consumer_version", nullable = false, length = 64)
	private String consumerVersion;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private VerificationStatus status;

	@Column(columnDefinition = "TEXT")
	private String details;

	@Column(length = 128)
	private String branch;

	@Column(name = "verified_at", nullable = false, updatable = false)
	private Instant verifiedAt;

	@Version
	@Column(name = "row_version")
	private Long rowVersion;

	protected Verification() {
	}

	private Verification(UUID providerId, String providerVersion, UUID consumerId, String consumerVersion,
			VerificationStatus status, @Nullable String details, @Nullable String branch) {
		this.providerId = providerId;
		this.providerVersion = providerVersion;
		this.consumerId = consumerId;
		this.consumerVersion = consumerVersion;
		this.status = status;
		this.details = details;
		this.branch = branch;
		this.verifiedAt = Instant.now();
	}

	static Verification create(UUID providerId, String providerVersion, UUID consumerId, String consumerVersion,
			VerificationStatus status, @Nullable String details, @Nullable String branch) {
		return new Verification(providerId, providerVersion, consumerId, consumerVersion, status, details, branch);
	}

	static Verification create(UUID providerId, String providerVersion, UUID consumerId, String consumerVersion,
			VerificationStatus status, @Nullable String details) {
		return create(providerId, providerVersion, consumerId, consumerVersion, status, details, null);
	}

	UUID getId() {
		return this.id;
	}

	UUID getProviderId() {
		return this.providerId;
	}

	String getProviderVersion() {
		return this.providerVersion;
	}

	UUID getConsumerId() {
		return this.consumerId;
	}

	String getConsumerVersion() {
		return this.consumerVersion;
	}

	VerificationStatus getStatus() {
		return this.status;
	}

	String getDetails() {
		return this.details;
	}

	String getBranch() {
		return this.branch;
	}

	Instant getVerifiedAt() {
		return this.verifiedAt;
	}

}
