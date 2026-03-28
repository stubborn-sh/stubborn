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
package sh.stubborn.oss.tag;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.micrometer.tracing.test.autoconfigure.AutoConfigureTracing;
import org.springframework.boot.restdocs.test.autoconfigure.AutoConfigureRestDocs;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.restdocs.mockmvc.RestDocumentationResultHandler;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import sh.stubborn.oss.audit.AuditService;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.BDDMockito.given;
import static org.springframework.cloud.contract.wiremock.restdocs.SpringCloudContractRestDocs.dslContract;
import static org.springframework.restdocs.mockmvc.MockMvcRestDocumentation.document;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Tag("generate-stubs")
@WebMvcTest(TagController.class)
@AutoConfigureTracing
@AutoConfigureRestDocs
@WithMockUser(roles = "ADMIN")
@TestPropertySource(properties = "broker.pro.enabled=true")
class TagContractTest {

	@Autowired
	MockMvc mockMvc;

	@MockitoBean
	TagService tagService;

	@SuppressWarnings("unused")
	@MockitoBean
	AuditService auditService;

	@Test
	void should_add_tag_to_version() throws Exception {
		// given
		var versionTag = VersionTag.create(UUID.randomUUID(), "1.0.0", "RELEASE");
		given(this.tagService.addTag("tag-app", "1.0.0", "RELEASE")).willReturn(versionTag);

		// when/then
		this.mockMvc.perform(put("/api/v1/applications/tag-app/versions/1.0.0/tags/RELEASE"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.tag").value("RELEASE"))
			.andExpect(jsonPath("$.version").value("1.0.0"))
			.andDo(contractDocument("add-tag"));
	}

	@Test
	void should_list_tags_for_version() throws Exception {
		// given
		var tag1 = VersionTag.create(UUID.randomUUID(), "1.0.0", "RELEASE");
		var tag2 = VersionTag.create(UUID.randomUUID(), "1.0.0", "STABLE");
		given(this.tagService.findTagsByVersion("tag-list-app", "1.0.0")).willReturn(List.of(tag1, tag2));

		// when/then
		this.mockMvc.perform(get("/api/v1/applications/tag-list-app/versions/1.0.0/tags"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].tag").value("RELEASE"))
			.andExpect(jsonPath("$[1].tag").value("STABLE"))
			.andDo(contractDocument("list-tags"));
	}

	@Test
	void should_get_latest_version_by_tag() throws Exception {
		// given
		given(this.tagService.findLatestVersionByTag("tag-latest-app", "RELEASE")).willReturn("2.0.0");

		// when/then
		this.mockMvc.perform(get("/api/v1/applications/tag-latest-app/versions/latest").param("tag", "RELEASE"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.version").value("2.0.0"))
			.andDo(contractDocument("get-latest-by-tag"));
	}

	@Test
	void should_remove_tag() throws Exception {
		// when/then
		this.mockMvc.perform(delete("/api/v1/applications/tag-remove-app/versions/1.0.0/tags/OLD"))
			.andExpect(status().isNoContent())
			.andDo(contractDocument("remove-tag"));
	}

	private static RestDocumentationResultHandler contractDocument(String identifier) {
		return document(identifier, dslContract());
	}

}
