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
package sh.stubborn.oss.spi;

import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.micrometer.tracing.test.autoconfigure.AutoConfigureTracing;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import sh.stubborn.oss.audit.AuditService;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(BrokerInfoController.class)
@AutoConfigureTracing
@WithMockUser(roles = "ADMIN")
class BrokerInfoControllerTest {

	@Autowired
	private MockMvc mockMvc;

	@MockitoBean
	private BrokerLicenseChecker licenseChecker;

	@SuppressWarnings("unused")
	@MockitoBean
	AuditService auditService;

	@Test
	void infoReturnsCommunityEditionWhenProDisabled() throws Exception {
		given(this.licenseChecker.isProEnabled()).willReturn(false);
		given(this.licenseChecker.edition()).willReturn("community");

		this.mockMvc.perform(get("/api/v1/broker/info"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.edition").value("community"))
			.andExpect(jsonPath("$.proEnabled").value(false))
			.andExpect(jsonPath("$.activeFeatures", hasItem("applications")))
			.andExpect(jsonPath("$.activeFeatures", hasItem("contracts")))
			.andExpect(jsonPath("$.activeFeatures", hasItem("can-i-deploy")))
			.andExpect(jsonPath("$.activeFeatures", not(hasItem("tags"))))
			.andExpect(jsonPath("$.activeFeatures", not(hasItem("selectors"))))
			.andExpect(jsonPath("$.activeFeatures", not(hasItem("matrix"))))
			.andExpect(jsonPath("$.activeFeatures", not(hasItem("cleanup"))));
	}

	@Test
	void infoReturnsProFeaturesWhenProEnabled() throws Exception {
		given(this.licenseChecker.isProEnabled()).willReturn(true);
		given(this.licenseChecker.edition()).willReturn("team");

		this.mockMvc.perform(get("/api/v1/broker/info"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.edition").value("team"))
			.andExpect(jsonPath("$.proEnabled").value(true))
			.andExpect(jsonPath("$.activeFeatures", hasItem("applications")))
			.andExpect(jsonPath("$.activeFeatures", hasItem("contracts")))
			.andExpect(jsonPath("$.activeFeatures", hasItem("tags")))
			.andExpect(jsonPath("$.activeFeatures", hasItem("selectors")))
			.andExpect(jsonPath("$.activeFeatures", hasItem("matrix")))
			.andExpect(jsonPath("$.activeFeatures", hasItem("cleanup")));
	}

	@Test
	void infoReturnsAllOssFeatures() throws Exception {
		given(this.licenseChecker.isProEnabled()).willReturn(false);
		given(this.licenseChecker.edition()).willReturn("community");

		this.mockMvc.perform(get("/api/v1/broker/info"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.activeFeatures", hasSize(7)))
			.andExpect(jsonPath("$.activeFeatures", hasItem("applications")))
			.andExpect(jsonPath("$.activeFeatures", hasItem("contracts")))
			.andExpect(jsonPath("$.activeFeatures", hasItem("verifications")))
			.andExpect(jsonPath("$.activeFeatures", hasItem("environments")))
			.andExpect(jsonPath("$.activeFeatures", hasItem("can-i-deploy")))
			.andExpect(jsonPath("$.activeFeatures", hasItem("graph")))
			.andExpect(jsonPath("$.activeFeatures", hasItem("webhooks")));
	}

	@Test
	void infoReturnsOssPlusProFeatures() throws Exception {
		given(this.licenseChecker.isProEnabled()).willReturn(true);
		given(this.licenseChecker.edition()).willReturn("enterprise");

		this.mockMvc.perform(get("/api/v1/broker/info"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.activeFeatures", hasSize(11)))
			.andExpect(jsonPath("$.edition").value("enterprise"));
	}

}
