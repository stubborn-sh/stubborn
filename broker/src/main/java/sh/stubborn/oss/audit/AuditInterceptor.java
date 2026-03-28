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

import java.util.Map;
import java.util.Set;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Spring MVC interceptor that logs mutating API calls (POST, PUT, DELETE) via
 * {@link AuditService}. Registered for {@code /api/**} paths in
 * {@link AuditWebMvcConfig}.
 *
 * @see AuditService
 * @see AuditWebMvcConfig
 */
@Component
class AuditInterceptor implements HandlerInterceptor {

	private static final Logger logger = LoggerFactory.getLogger(AuditInterceptor.class);

	private static final Set<String> AUDITED_METHODS = Set.of("POST", "PUT", "DELETE");

	private static final Map<String, AuditAction> METHOD_TO_ACTION = Map.of("POST", AuditAction.CREATE, "PUT",
			AuditAction.UPDATE, "DELETE", AuditAction.DELETE);

	private final AuditService auditService;

	AuditInterceptor(AuditService auditService) {
		this.auditService = auditService;
	}

	@Override
	public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler,
			@Nullable Exception ex) {
		String method = request.getMethod();
		if (!AUDITED_METHODS.contains(method)) {
			return;
		}
		try {
			String principal = resolvePrincipal();
			AuditAction action = resolveAction(method, request.getRequestURI());
			AuditResourceType resourceType = resolveResourceType(request.getRequestURI());
			String resourceId = resolveResourceId(request.getRequestURI());
			String summary = method + " " + request.getRequestURI();
			String ipAddress = request.getRemoteAddr();
			String traceId = request.getHeader("X-B3-TraceId");
			this.auditService.logAction(principal, action, resourceType, resourceId, summary, response.getStatus(),
					ipAddress, traceId);
		}
		catch (Exception auditEx) {
			logger.warn("Failed to record audit log for {} {}: {}", method, request.getRequestURI(),
					auditEx.getMessage());
		}
	}

	private String resolvePrincipal() {
		Authentication auth = SecurityContextHolder.getContext().getAuthentication();
		if (auth != null && auth.isAuthenticated()) {
			return auth.getName();
		}
		return "anonymous";
	}

	private AuditAction resolveAction(String method, String uri) {
		if (uri.contains("/import") || uri.contains("/maven") || uri.contains("/git")) {
			if ("POST".equals(method)) {
				return AuditAction.IMPORT;
			}
		}
		if (uri.contains("/deploy")) {
			return AuditAction.DEPLOY;
		}
		return METHOD_TO_ACTION.getOrDefault(method, AuditAction.CREATE);
	}

	AuditResourceType resolveResourceType(String uri) {
		// Check more specific paths first (tags, deployments) before broader ones
		// (applications)
		if (uri.contains("/tags")) {
			return AuditResourceType.TAG;
		}
		if (uri.contains("/deployments")) {
			return AuditResourceType.DEPLOYMENT;
		}
		if (uri.contains("/contracts")) {
			return AuditResourceType.CONTRACT;
		}
		if (uri.contains("/verifications")) {
			return AuditResourceType.VERIFICATION;
		}
		if (uri.contains("/webhooks")) {
			return AuditResourceType.WEBHOOK;
		}
		if (uri.contains("/environments")) {
			return AuditResourceType.ENVIRONMENT;
		}
		if (uri.contains("/maven")) {
			return AuditResourceType.MAVEN_SOURCE;
		}
		if (uri.contains("/git")) {
			return AuditResourceType.GIT_SOURCE;
		}
		if (uri.contains("/applications")) {
			return AuditResourceType.APPLICATION;
		}
		return AuditResourceType.APPLICATION;
	}

	@Nullable private String resolveResourceId(String uri) {
		// Extract 5th path segment: /api/v1/{resource}/{id} -> {id}
		// Counting slashes to find the segment without using String.split()
		int slashCount = 0;
		int segmentStart = -1;
		for (int i = 0; i < uri.length(); i++) {
			if (uri.charAt(i) == '/') {
				slashCount++;
				if (slashCount == 4) {
					segmentStart = i + 1;
				}
				if (slashCount == 5) {
					return uri.substring(segmentStart, i);
				}
			}
		}
		if (slashCount >= 4 && segmentStart > 0 && segmentStart < uri.length()) {
			return uri.substring(segmentStart);
		}
		return null;
	}

}
