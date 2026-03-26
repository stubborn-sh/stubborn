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
package org.example.payment;

import java.util.Map;

import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cloud.contract.stubrunner.spring.AutoConfigureStubRunner;
import org.springframework.cloud.contract.stubrunner.spring.StubRunnerProperties;
import org.springframework.cloud.contract.stubrunner.spring.StubRunnerPort;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Consumer contract test that uses @AutoConfigureStubRunner with sccbroker:// protocol to
 * fetch contracts from the running broker instance and configure WireMock stubs.
 */
@SpringBootTest
@AutoConfigureStubRunner(ids = "sh.stubborn:order-service:1.0.0:stubs",
		repositoryRoot = "sccbroker://http://localhost:18080", stubsMode = StubRunnerProperties.StubsMode.REMOTE,
		properties = { "spring.cloud.contract.stubrunner.username=reader",
				"spring.cloud.contract.stubrunner.password=reader" })
class OrderServiceContractIT {

	@StubRunnerPort("order-service")
	int stubPort;

	@Autowired
	PaymentService paymentService;

	@Test
	@SuppressWarnings("rawtypes")
	void should_get_order_from_stub() {
		// given
		String orderServiceUrl = "http://localhost:" + this.stubPort;

		// when
		Map order = this.paymentService.getOrderForPayment(orderServiceUrl, "1");

		// then
		assertThat(order).containsEntry("product", "MacBook Pro");
		assertThat(order).containsEntry("status", "CREATED");
	}

}
