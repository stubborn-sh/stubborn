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

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;

/**
 * Shipping controller that calls the Order Service via the AI proxy. The proxy captures
 * the traffic and generates Spring Cloud Contract definitions.
 */
@RestController
@RequestMapping("/api/shipping")
public class ShippingController {

	private final RestClient restClient;

	private final String proxyUrl;

	public ShippingController(RestClient.Builder builder,
			@Value("${proxy.url:http://localhost:18081}") String proxyUrl) {
		this.restClient = builder.build();
		this.proxyUrl = proxyUrl;
	}

	@GetMapping("/orders/{orderId}")
	@SuppressWarnings("rawtypes")
	public ResponseEntity<Map> getShippingForOrder(@PathVariable String orderId) {
		Map order = this.restClient.get().uri(this.proxyUrl + "/api/orders/{id}", orderId).retrieve().body(Map.class);
		return ResponseEntity.ok(Map.of("orderId", orderId, "order", order, "carrier", "FedEx", "status", "PENDING"));
	}

}
