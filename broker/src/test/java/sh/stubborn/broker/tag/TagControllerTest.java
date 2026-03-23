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
package sh.stubborn.broker.tag;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.micrometer.tracing.test.autoconfigure.AutoConfigureTracing;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(TagController.class)
@AutoConfigureTracing
@TestPropertySource(properties = "broker.pro.enabled=true")
class TagControllerTest {

	@Autowired
	MockMvc mockMvc;

	@MockitoBean
	TagService tagService;

	@Test
	@WithMockUser(roles = "PUBLISHER")
	void should_add_tag_to_version() throws Exception {
		// given
		VersionTag tag = VersionTag.create(UUID.randomUUID(), "1.0.0", "prod");
		given(this.tagService.addTag("order-service", "1.0.0", "prod")).willReturn(tag);

		// when/then
		this.mockMvc.perform(put("/api/v1/applications/order-service/versions/1.0.0/tags/prod"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.tag").value("prod"))
			.andExpect(jsonPath("$.version").value("1.0.0"));
	}

	@Test
	@WithMockUser(roles = "PUBLISHER")
	void should_remove_tag() throws Exception {
		// when/then
		this.mockMvc.perform(delete("/api/v1/applications/order-service/versions/1.0.0/tags/prod"))
			.andExpect(status().isNoContent());

		then(this.tagService).should().removeTag("order-service", "1.0.0", "prod");
	}

	@Test
	@WithMockUser(roles = "READER")
	void should_get_tags_for_version() throws Exception {
		// given
		VersionTag tag = VersionTag.create(UUID.randomUUID(), "1.0.0", "prod");
		given(this.tagService.findTagsByVersion("order-service", "1.0.0")).willReturn(List.of(tag));

		// when/then
		this.mockMvc.perform(get("/api/v1/applications/order-service/versions/1.0.0/tags"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].tag").value("prod"));
	}

	@Test
	@WithMockUser(roles = "READER")
	void should_get_latest_version_by_tag() throws Exception {
		// given
		given(this.tagService.findLatestVersionByTag("order-service", "prod")).willReturn("2.0.0");

		// when/then
		this.mockMvc.perform(get("/api/v1/applications/order-service/versions/latest").param("tag", "prod"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.version").value("2.0.0"));
	}

}
