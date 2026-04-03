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
package org.example.verification;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class VerificationListener {

	private static final Logger log = LoggerFactory.getLogger(VerificationListener.class);

	private final List<VerificationResult> received = Collections.synchronizedList(new ArrayList<>());

	@KafkaListener(topics = "verifications", groupId = "verification-processor")
	public void onVerification(VerificationResult result) {
		log.info("Received verification: id={}, status={}", result.id(), result.status());
		this.received.add(result);
	}

	public List<VerificationResult> getReceived() {
		return List.copyOf(this.received);
	}

}
