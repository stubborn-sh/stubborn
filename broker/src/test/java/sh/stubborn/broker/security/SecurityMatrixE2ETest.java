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
package sh.stubborn.broker.security;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import sh.stubborn.broker.TestcontainersConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class SecurityMatrixE2ETest {

	@Autowired
	MockMvc mockMvc;

	@ParameterizedTest(name = "GET {0} as ANONYMOUS -> {1}")
	@CsvSource({ "/actuator/health, 200", "/api/v1/applications, 401", "/api/v1/can-i-deploy, 401" })
	void should_enforce_anonymous_access(String path, int expected) throws Exception {
		this.mockMvc.perform(get(path)).andExpect(status().is(expected));
	}

	@ParameterizedTest(name = "GET {0} as READER -> {1}")
	@CsvSource({ "/api/v1/applications, 200", "/api/v1/can-i-deploy, 400" })
	void should_allow_reader_get_access(String path, int expected) throws Exception {
		this.mockMvc.perform(get(path).with(httpBasic("reader", "reader"))).andExpect(status().is(expected));
	}

	@ParameterizedTest(name = "POST {0} as READER -> {1}")
	@CsvSource({ "/api/v1/applications, 403", "/api/v1/verifications, 403" })
	void should_deny_reader_write_access(String path, int expected) throws Exception {
		this.mockMvc.perform(
				post(path).with(httpBasic("reader", "reader")).contentType(MediaType.APPLICATION_JSON).content("{}"))
			.andExpect(status().is(expected));
	}

	@ParameterizedTest(name = "POST {0} as PUBLISHER -> {1}")
	@CsvSource({ "/api/v1/applications, 403", "/api/v1/verifications, 400" })
	void should_enforce_publisher_role(String path, int expected) throws Exception {
		this.mockMvc
			.perform(post(path).with(httpBasic("publisher", "publisher"))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{}"))
			.andExpect(status().is(expected));
	}

	@ParameterizedTest(name = "POST/DELETE as ADMIN -> allowed")
	@CsvSource({ "POST, /api/v1/applications, 400", "DELETE, /api/v1/applications/nonexistent, 404" })
	void should_allow_admin_full_access(String method, String path, int expected) throws Exception {
		if ("POST".equals(method)) {
			this.mockMvc.perform(
					post(path).with(httpBasic("admin", "admin")).contentType(MediaType.APPLICATION_JSON).content("{}"))
				.andExpect(status().is(expected));
		}
		else {
			this.mockMvc.perform(delete(path).with(httpBasic("admin", "admin"))).andExpect(status().is(expected));
		}
	}

}
