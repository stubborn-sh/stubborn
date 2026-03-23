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
package sh.stubborn.broker.webhook;

import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface WebhookRepository extends JpaRepository<Webhook, UUID> {

	@Override
	Page<Webhook> findAll(Pageable pageable);

	List<Webhook> findByEventTypeAndEnabled(EventType eventType, boolean enabled);

	@Query("SELECT w FROM Webhook w WHERE w.eventType = :eventType AND w.enabled = true"
			+ " AND (w.applicationId IS NULL OR w.applicationId = :applicationId)")
	List<Webhook> findMatchingWebhooks(EventType eventType, UUID applicationId);

	@Query("SELECT w FROM Webhook w WHERE LOWER(w.url) LIKE LOWER(CONCAT('%', :search, '%'))"
			+ " OR LOWER(CAST(w.eventType AS string)) LIKE LOWER(CONCAT('%', :search, '%'))")
	Page<Webhook> searchByEventTypeOrUrl(@Param("search") String search, Pageable pageable);

}
