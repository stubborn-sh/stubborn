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
package sh.stubborn.oss.mavenimport;

import java.util.List;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.micrometer.tracing.test.autoconfigure.AutoConfigureTracing;
import org.springframework.boot.restdocs.test.autoconfigure.AutoConfigureRestDocs;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.restdocs.mockmvc.RestDocumentationResultHandler;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.cloud.contract.wiremock.restdocs.SpringCloudContractRestDocs.dslContract;
import static org.springframework.restdocs.mockmvc.MockMvcRestDocumentation.document;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Tag("generate-stubs")
@WebMvcTest(MavenImportController.class)
@AutoConfigureTracing
@AutoConfigureRestDocs
@WithMockUser(roles = "ADMIN")
class MavenImportContractTest {

	@Autowired
	MockMvc mockMvc;

	@MockitoBean
	MavenImportService importService;

	@MockitoBean
	MavenStubsDiscoveryService discoveryService;

	@Test
	void should_import_jar() throws Exception {
		// given
		given(this.importService.importJar("order-service", "https://repo.example.com", "com.example", "order-stubs",
				"1.0.0", null, null))
			.willReturn(new MavenImportService.MavenImportResult(3, 0, 3));

		// when/then
		this.mockMvc.perform(post("/api/v1/import/maven-jar").contentType(MediaType.APPLICATION_JSON).content("""
				{
				  "applicationName": "order-service",
				  "repositoryUrl": "https://repo.example.com",
				  "groupId": "com.example",
				  "artifactId": "order-stubs",
				  "version": "1.0.0"
				}
				"""))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.published").value(3))
			.andDo(contractDocument("import-maven-jar"));
	}

	@Test
	void should_register_source() throws Exception {
		// given
		MavenImportSource source = MavenImportSource.create("https://repo.example.com", "com.example", "order-stubs",
				null, null, true);
		given(this.importService.registerSource("https://repo.example.com", "com.example", "order-stubs", null, null,
				true))
			.willReturn(source);

		// when/then
		this.mockMvc.perform(post("/api/v1/import/sources").contentType(MediaType.APPLICATION_JSON).content("""
				{
				  "repositoryUrl": "https://repo.example.com",
				  "groupId": "com.example",
				  "artifactId": "order-stubs",
				  "syncEnabled": true
				}
				"""))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.repositoryUrl").value("https://repo.example.com"))
			.andDo(contractDocument("register-import-source"));
	}

	@Test
	void should_list_sources() throws Exception {
		// given
		MavenImportSource source = MavenImportSource.create("https://repo.example.com", "com.example", "order-stubs",
				null, null, true);
		given(this.importService.listSources(any(Pageable.class))).willReturn(new PageImpl<>(List.of(source)));

		// when/then
		this.mockMvc.perform(get("/api/v1/import/sources"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.content[0].groupId").value("com.example"))
			.andDo(contractDocument("list-import-sources"));
	}

	private static RestDocumentationResultHandler contractDocument(String identifier) {
		return document(identifier, dslContract());
	}

}
