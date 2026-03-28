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
package sh.stubborn.oss.audit;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class AuditServiceTest {

	@Mock
	ApiAuditLogRepository repository;

	AuditService service;

	@BeforeEach
	void setUp() {
		this.service = new AuditService(this.repository);
	}

	@Test
	void should_persist_audit_entry_with_all_fields() {
		// given
		given(this.repository.save(any(ApiAuditLog.class))).willAnswer(invocation -> invocation.getArgument(0));

		// when
		this.service.logAction("admin", AuditAction.CREATE, AuditResourceType.APPLICATION, "order-service",
				"POST /api/v1/applications", 201, "127.0.0.1", "abc123");

		// then
		ArgumentCaptor<ApiAuditLog> captor = ArgumentCaptor.forClass(ApiAuditLog.class);
		verify(this.repository).save(captor.capture());
		ApiAuditLog saved = captor.getValue();
		assertThat(saved.getPrincipal()).isEqualTo("admin");
		assertThat(saved.getAction()).isEqualTo(AuditAction.CREATE);
		assertThat(saved.getResourceType()).isEqualTo(AuditResourceType.APPLICATION);
		assertThat(saved.getResourceId()).isEqualTo("order-service");
		assertThat(saved.getRequestSummary()).isEqualTo("POST /api/v1/applications");
		assertThat(saved.getResponseStatus()).isEqualTo(201);
		assertThat(saved.getIpAddress()).isEqualTo("127.0.0.1");
		assertThat(saved.getTraceId()).isEqualTo("abc123");
		assertThat(saved.getTimestamp()).isNotNull();
	}

	@Test
	void should_persist_audit_entry_with_null_optional_fields() {
		// given
		given(this.repository.save(any(ApiAuditLog.class))).willAnswer(invocation -> invocation.getArgument(0));

		// when
		this.service.logAction("publisher", AuditAction.DELETE, AuditResourceType.CONTRACT, null, null, null, null,
				null);

		// then
		ArgumentCaptor<ApiAuditLog> captor = ArgumentCaptor.forClass(ApiAuditLog.class);
		verify(this.repository).save(captor.capture());
		ApiAuditLog saved = captor.getValue();
		assertThat(saved.getPrincipal()).isEqualTo("publisher");
		assertThat(saved.getAction()).isEqualTo(AuditAction.DELETE);
		assertThat(saved.getResourceId()).isNull();
		assertThat(saved.getRequestSummary()).isNull();
		assertThat(saved.getResponseStatus()).isNull();
	}

	@Test
	void should_find_all_paginated() {
		// given
		ApiAuditLog entry = ApiAuditLog.create("admin", AuditAction.CREATE, AuditResourceType.APPLICATION,
				"order-service", "POST /api/v1/applications", 201, "127.0.0.1", null);
		Page<ApiAuditLog> page = new PageImpl<>(List.of(entry));
		given(this.repository.findAllByOrderByTimestampDesc(any())).willReturn(page);

		// when
		Page<ApiAuditLog> result = this.service.findAll(PageRequest.of(0, 10));

		// then
		assertThat(result.getContent()).hasSize(1);
		assertThat(result.getContent().get(0).getPrincipal()).isEqualTo("admin");
	}

	@Test
	void should_find_filtered_by_principal_and_action() {
		// given
		ApiAuditLog entry = ApiAuditLog.create("admin", AuditAction.DELETE, AuditResourceType.WEBHOOK, "wh-1",
				"DELETE /api/v1/webhooks/wh-1", 204, "10.0.0.1", null);
		Page<ApiAuditLog> page = new PageImpl<>(List.of(entry));
		given(this.repository.findFiltered("admin", AuditAction.DELETE, null, PageRequest.of(0, 10))).willReturn(page);

		// when
		Page<ApiAuditLog> result = this.service.findFiltered("admin", AuditAction.DELETE, null, PageRequest.of(0, 10));

		// then
		assertThat(result.getContent()).hasSize(1);
		assertThat(result.getContent().get(0).getAction()).isEqualTo(AuditAction.DELETE);
	}

	@Test
	void should_delegate_to_find_all_when_no_filters() {
		// given
		Page<ApiAuditLog> page = new PageImpl<>(List.of());
		given(this.repository.findAllByOrderByTimestampDesc(any())).willReturn(page);

		// when
		Page<ApiAuditLog> result = this.service.findFiltered(null, null, null, PageRequest.of(0, 10));

		// then
		verify(this.repository).findAllByOrderByTimestampDesc(any());
		assertThat(result.getContent()).isEmpty();
	}

}
