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
package org.example.order;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

	private final Map<String, Map<String, Object>> orders = new ConcurrentHashMap<>();

	public OrderController() {
		this.orders.put("1", Map.of("id", "1", "product", "MacBook Pro", "amount", 1299.99, "status", "CREATED"));
	}

	@GetMapping("/{id}")
	public ResponseEntity<Map<String, Object>> getOrder(@PathVariable String id) {
		Map<String, Object> order = this.orders.get(id);
		if (order == null) {
			return ResponseEntity.notFound().build();
		}
		return ResponseEntity.ok(order);
	}

}
