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
package org.example.shipping;

import java.util.Map;

import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Sends traffic through the AI proxy to generate contract definitions. Requires the proxy
 * and broker to be running (docker compose --profile proxy up). The proxy will capture
 * traffic and generate contracts via AI.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ProxyTrafficIT {

	@LocalServerPort
	int port;

	@Autowired
	RestClient.Builder restClientBuilder;

	@Test
	@SuppressWarnings("rawtypes")
	void should_call_order_service_via_proxy() {
		// given
		RestClient client = this.restClientBuilder.baseUrl("http://localhost:" + this.port).build();

		// when
		Map response = client.get().uri("/api/shipping/orders/1").retrieve().body(Map.class);

		// then
		assertThat(response).containsEntry("orderId", "1");
		assertThat(response).containsEntry("carrier", "FedEx");
	}

}
