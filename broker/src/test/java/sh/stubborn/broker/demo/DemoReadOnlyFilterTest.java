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

import java.lang.reflect.Constructor;

import jakarta.servlet.FilterChain;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * Unit tests for {@link DemoReadOnlyFilter}.
 */
class DemoReadOnlyFilterTest {

	private OncePerRequestFilter filter;

	private FilterChain filterChain;

	@BeforeEach
	void setUp() throws Exception {
		Constructor<DemoReadOnlyFilter> ctor = DemoReadOnlyFilter.class.getDeclaredConstructor();
		ctor.setAccessible(true);
		this.filter = ctor.newInstance();
		this.filterChain = mock(FilterChain.class);
	}

	@Test
	void get_request_passes_through() throws Exception {
		MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/applications");
		MockHttpServletResponse response = new MockHttpServletResponse();

		this.filter.doFilter(request, response, this.filterChain);

		verify(this.filterChain).doFilter(request, response);
	}

	@Test
	void head_request_passes_through() throws Exception {
		MockHttpServletRequest request = new MockHttpServletRequest("HEAD", "/api/v1/applications");
		MockHttpServletResponse response = new MockHttpServletResponse();

		this.filter.doFilter(request, response, this.filterChain);

		verify(this.filterChain).doFilter(request, response);
	}

	@Test
	void options_request_passes_through() throws Exception {
		MockHttpServletRequest request = new MockHttpServletRequest("OPTIONS", "/api/v1/applications");
		MockHttpServletResponse response = new MockHttpServletResponse();

		this.filter.doFilter(request, response, this.filterChain);

		verify(this.filterChain).doFilter(request, response);
	}

	@Test
	void post_request_returns_403() throws Exception {
		MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/applications");
		MockHttpServletResponse response = new MockHttpServletResponse();

		this.filter.doFilter(request, response, this.filterChain);

		assertThat(response.getStatus()).isEqualTo(HttpStatus.FORBIDDEN.value());
		assertThat(response.getContentType()).isEqualTo(MediaType.APPLICATION_JSON_VALUE);
		assertThat(response.getContentAsString()).contains("DEMO_READ_ONLY")
			.contains("Write operations are disabled in demo mode");
		verifyNoInteractions(this.filterChain);
	}

	@Test
	void put_request_returns_403() throws Exception {
		MockHttpServletRequest request = new MockHttpServletRequest("PUT", "/api/v1/applications/order-service");
		MockHttpServletResponse response = new MockHttpServletResponse();

		this.filter.doFilter(request, response, this.filterChain);

		assertThat(response.getStatus()).isEqualTo(HttpStatus.FORBIDDEN.value());
		verifyNoInteractions(this.filterChain);
	}

	@Test
	void delete_request_returns_403() throws Exception {
		MockHttpServletRequest request = new MockHttpServletRequest("DELETE", "/api/v1/applications/order-service");
		MockHttpServletResponse response = new MockHttpServletResponse();

		this.filter.doFilter(request, response, this.filterChain);

		assertThat(response.getStatus()).isEqualTo(HttpStatus.FORBIDDEN.value());
		verifyNoInteractions(this.filterChain);
	}

	@Test
	void patch_request_returns_403() throws Exception {
		MockHttpServletRequest request = new MockHttpServletRequest("PATCH", "/api/v1/applications/order-service");
		MockHttpServletResponse response = new MockHttpServletResponse();

		this.filter.doFilter(request, response, this.filterChain);

		assertThat(response.getStatus()).isEqualTo(HttpStatus.FORBIDDEN.value());
		verifyNoInteractions(this.filterChain);
	}

}
