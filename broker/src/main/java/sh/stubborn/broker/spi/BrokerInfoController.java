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

import java.util.ArrayList;
import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/broker")
class BrokerInfoController {

	private static final List<String> OSS_FEATURES = List.of("applications", "contracts", "verifications",
			"environments", "can-i-deploy", "graph", "webhooks");

	private static final List<String> PRO_FEATURES = List.of("tags", "selectors", "matrix", "cleanup");

	private final BrokerLicenseChecker licenseChecker;

	BrokerInfoController(BrokerLicenseChecker licenseChecker) {
		this.licenseChecker = licenseChecker;
	}

	@GetMapping("/info")
	ResponseEntity<BrokerInfoResponse> info() {
		List<String> activeFeatures = new ArrayList<>(OSS_FEATURES);
		if (this.licenseChecker.isProEnabled()) {
			activeFeatures.addAll(PRO_FEATURES);
		}
		return ResponseEntity.ok(new BrokerInfoResponse(this.licenseChecker.edition(),
				this.licenseChecker.isProEnabled(), List.copyOf(activeFeatures)));
	}

}
