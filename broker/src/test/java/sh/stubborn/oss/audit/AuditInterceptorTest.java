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

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class AuditInterceptorTest {

	@Mock
	AuditService auditService;

	AuditInterceptor interceptor;

	@BeforeEach
	void setUp() {
		this.interceptor = new AuditInterceptor(this.auditService);
	}

	@AfterEach
	void tearDown() {
		SecurityContextHolder.clearContext();
	}

	@Test
	void should_log_post_request() {
		// given
		setAuthentication("admin");
		MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/applications");
		request.setRemoteAddr("192.168.1.1");
		MockHttpServletResponse response = new MockHttpServletResponse();
		response.setStatus(201);

		// when
		this.interceptor.afterCompletion(request, response, new Object(), null);

		// then
		ArgumentCaptor<String> summaryCaptor = ArgumentCaptor.forClass(String.class);
		verify(this.auditService).logAction(eq("admin"), eq(AuditAction.CREATE), eq(AuditResourceType.APPLICATION),
				any(), summaryCaptor.capture(), eq(201), eq("192.168.1.1"), any());
		assertThat(summaryCaptor.getValue()).contains("POST");
		assertThat(summaryCaptor.getValue()).contains("/api/v1/applications");
	}

	@Test
	void should_log_delete_request() {
		// given
		setAuthentication("publisher");
		MockHttpServletRequest request = new MockHttpServletRequest("DELETE",
				"/api/v1/contracts/order-service/1.0.0/my-contract");
		MockHttpServletResponse response = new MockHttpServletResponse();
		response.setStatus(204);

		// when
		this.interceptor.afterCompletion(request, response, new Object(), null);

		// then
		verify(this.auditService).logAction(eq("publisher"), eq(AuditAction.DELETE), eq(AuditResourceType.CONTRACT),
				any(), any(), eq(204), any(), any());
	}

	@Test
	void should_log_put_request_as_update() {
		// given
		setAuthentication("admin");
		MockHttpServletRequest request = new MockHttpServletRequest("PUT", "/api/v1/environments/production");
		MockHttpServletResponse response = new MockHttpServletResponse();
		response.setStatus(200);

		// when
		this.interceptor.afterCompletion(request, response, new Object(), null);

		// then
		verify(this.auditService).logAction(eq("admin"), eq(AuditAction.UPDATE), eq(AuditResourceType.ENVIRONMENT),
				any(), any(), eq(200), any(), any());
	}

	@Test
	void should_not_log_get_request() {
		// given
		MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/applications");
		MockHttpServletResponse response = new MockHttpServletResponse();

		// when
		this.interceptor.afterCompletion(request, response, new Object(), null);

		// then
		verify(this.auditService, never()).logAction(any(), any(), any(), any(), any(), any(), any(), any());
	}

	@Test
	void should_use_anonymous_when_no_authentication() {
		// given — no authentication set
		MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/applications");
		MockHttpServletResponse response = new MockHttpServletResponse();
		response.setStatus(201);

		// when
		this.interceptor.afterCompletion(request, response, new Object(), null);

		// then
		verify(this.auditService).logAction(eq("anonymous"), any(), any(), any(), any(), any(), any(), any());
	}

	@Test
	void should_resolve_resource_type_for_webhooks() {
		assertThat(this.interceptor.resolveResourceType("/api/v1/webhooks/abc")).isEqualTo(AuditResourceType.WEBHOOK);
	}

	@Test
	void should_resolve_resource_type_for_verifications() {
		assertThat(this.interceptor.resolveResourceType("/api/v1/verifications"))
			.isEqualTo(AuditResourceType.VERIFICATION);
	}

	@Test
	void should_resolve_resource_type_for_deployments() {
		assertThat(this.interceptor.resolveResourceType("/api/v1/deployments/dep-1"))
			.isEqualTo(AuditResourceType.DEPLOYMENT);
	}

	@Test
	void should_resolve_resource_type_for_tags() {
		assertThat(this.interceptor.resolveResourceType("/api/v1/applications/app/tags"))
			.isEqualTo(AuditResourceType.TAG);
	}

	@Test
	void should_resolve_resource_type_for_maven_import() {
		assertThat(this.interceptor.resolveResourceType("/api/v1/maven/sources"))
			.isEqualTo(AuditResourceType.MAVEN_SOURCE);
	}

	@Test
	void should_resolve_resource_type_for_git_import() {
		assertThat(this.interceptor.resolveResourceType("/api/v1/git/sources")).isEqualTo(AuditResourceType.GIT_SOURCE);
	}

	private void setAuthentication(String username) {
		UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(username, null,
				java.util.List.of());
		SecurityContextHolder.getContext().setAuthentication(auth);
	}

}
