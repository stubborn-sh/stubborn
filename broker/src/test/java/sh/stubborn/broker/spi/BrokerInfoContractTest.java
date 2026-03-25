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
package sh.stubborn.broker.spi;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.micrometer.tracing.test.autoconfigure.AutoConfigureTracing;
import org.springframework.boot.restdocs.test.autoconfigure.AutoConfigureRestDocs;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.restdocs.mockmvc.RestDocumentationResultHandler;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.hasItem;
import static org.mockito.BDDMockito.given;
import static org.springframework.cloud.contract.wiremock.restdocs.SpringCloudContractRestDocs.dslContract;
import static org.springframework.restdocs.mockmvc.MockMvcRestDocumentation.document;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Tag("generate-stubs")
@WebMvcTest(BrokerInfoController.class)
@AutoConfigureTracing
@AutoConfigureRestDocs
@WithMockUser(roles = "ADMIN")
class BrokerInfoContractTest {

	@Autowired
	MockMvc mockMvc;

	@MockitoBean
	BrokerLicenseChecker licenseChecker;

	@Test
	void should_get_broker_info() throws Exception {
		// given
		given(this.licenseChecker.isProEnabled()).willReturn(false);
		given(this.licenseChecker.edition()).willReturn("community");

		// when/then
		this.mockMvc.perform(get("/api/v1/broker/info"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.edition").value("community"))
			.andExpect(jsonPath("$.proEnabled").value(false))
			.andExpect(jsonPath("$.activeFeatures", hasItem("applications")))
			.andDo(contractDocument("get-broker-info"));
	}

	private static RestDocumentationResultHandler contractDocument(String identifier) {
		return document(identifier, dslContract());
	}

}
