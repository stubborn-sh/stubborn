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
package org.example.notification;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import sh.stubborn.contract.verifier.messaging.boot.AutoConfigureMessageVerifier;

/**
 * Base class for the generated messaging contract test.
 *
 * <p>
 * The {@code triggerNotification()} method is referenced by the contract's
 * {@code input.triggeredBy} field. Stubborn calls it to trigger message production, then
 * asserts the output message matches the contract.
 *
 * <p>
 * {@code @AutoConfigureMessageVerifier} activates the
 * {@code stubborn-contract-messaging-jms} building block's auto-configuration, which
 * provides {@code MessageVerifierSender} / {@code MessageVerifierReceiver} beans over the
 * application's JMS {@code ConnectionFactory}. The broker is the embedded, in-VM ActiveMQ
 * Artemis instance configured in {@code application.yml}
 * ({@code spring.artemis.mode=embedded}) — no Docker.
 */
@SpringBootTest
@AutoConfigureMessageVerifier
public abstract class NotificationContractBase {

	@Autowired
	NotificationService notificationService;

	public void triggerNotification() {
		this.notificationService.sendNotification(
				new NotificationEvent("ORDER_CONFIRMED", "user@example.com", "Your order has been confirmed"));
	}

}
