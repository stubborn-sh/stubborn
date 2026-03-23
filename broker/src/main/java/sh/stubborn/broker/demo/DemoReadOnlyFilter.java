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
package sh.stubborn.broker.demo;

import java.io.IOException;
import java.util.Set;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.context.annotation.Profile;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Servlet filter that blocks all write operations when the {@code demo} profile is
 * active. Only GET, HEAD, and OPTIONS requests are allowed through; all other HTTP
 * methods receive a 403 Forbidden response with a JSON error body.
 */
@Component
@Profile("demo")
@Order(Ordered.HIGHEST_PRECEDENCE)
class DemoReadOnlyFilter extends OncePerRequestFilter {

	private static final Set<String> ALLOWED_METHODS = Set.of("GET", "HEAD", "OPTIONS");

	private static final String ERROR_BODY = "{\"code\":\"DEMO_READ_ONLY\",\"message\":\"Write operations are disabled in demo mode\"}";

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
			throws ServletException, IOException {
		if (ALLOWED_METHODS.contains(request.getMethod())) {
			filterChain.doFilter(request, response);
			return;
		}
		response.setStatus(HttpStatus.FORBIDDEN.value());
		response.setContentType(MediaType.APPLICATION_JSON_VALUE);
		response.getWriter().write(ERROR_BODY);
	}

}
