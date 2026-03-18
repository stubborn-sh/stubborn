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
package org.springframework.cloud.contract.broker.observability;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.List;

import io.micrometer.observation.annotation.Observed;
import org.junit.jupiter.api.Test;

import org.springframework.cloud.contract.broker.application.ApplicationService;
import org.springframework.cloud.contract.broker.contract.ContractService;
import org.springframework.cloud.contract.broker.environment.DeploymentService;
import org.springframework.cloud.contract.broker.graph.DependencyGraphService;
import org.springframework.cloud.contract.broker.safety.CanIDeployService;
import org.springframework.cloud.contract.broker.verification.VerificationService;
import org.springframework.cloud.contract.broker.maintenance.CleanupService;
import org.springframework.cloud.contract.broker.matrix.MatrixService;
import org.springframework.cloud.contract.broker.selector.SelectorService;
import org.springframework.cloud.contract.broker.tag.TagService;
import org.springframework.cloud.contract.broker.webhook.WebhookService;

import static org.assertj.core.api.Assertions.assertThat;

class ObservedAnnotationTest {

	@Test
	void should_have_observed_annotation_on_application_register() {
		// when/then
		assertObservedMethod(ApplicationService.class, "register", "broker.application.register");
	}

	@Test
	void should_have_observed_annotation_on_contract_publish() {
		// when/then
		assertObservedMethod(ContractService.class, "publish", "broker.contract.publish");
	}

	@Test
	void should_have_observed_annotation_on_verification_record() {
		// when/then
		assertObservedMethod(VerificationService.class, "record", "broker.verification.record");
	}

	@Test
	void should_have_observed_annotation_on_deployment_record() {
		// when/then
		assertObservedMethod(DeploymentService.class, "recordDeployment", "broker.deployment.record");
	}

	@Test
	void should_have_observed_annotation_on_can_i_deploy_check() {
		// when/then
		assertObservedMethod(CanIDeployService.class, "check", "broker.safety.check");
	}

	@Test
	void should_have_observed_annotation_on_graph_query() {
		// when/then
		assertObservedMethod(DependencyGraphService.class, "getGraph", "broker.graph.query");
	}

	@Test
	void should_have_observed_annotation_on_webhook_create() {
		// when/then
		assertObservedMethod(WebhookService.class, "create", "broker.webhook.create");
	}

	@Test
	void should_have_observed_annotation_on_matrix_query() {
		// when/then
		assertObservedMethod(MatrixService.class, "query", "broker.matrix.query");
	}

	@Test
	void should_have_observed_annotation_on_selector_resolve() {
		// when/then
		assertObservedMethod(SelectorService.class, "resolve", "broker.selector.resolve");
	}

	@Test
	void should_have_observed_annotation_on_tag_add() {
		// when/then
		assertObservedMethod(TagService.class, "addTag", "broker.tag.add");
	}

	@Test
	void should_have_observed_annotation_on_cleanup() {
		// when/then
		assertObservedMethod(CleanupService.class, "cleanup", "broker.maintenance.cleanup");
	}

	private void assertObservedMethod(Class<?> clazz, String methodName, String expectedObservationName) {
		List<Method> methods = Arrays.stream(clazz.getDeclaredMethods())
			.filter(m -> m.getName().equals(methodName))
			.toList();
		assertThat(methods).as("Expected method '%s' in %s", methodName, clazz.getSimpleName()).isNotEmpty();
		boolean hasObserved = methods.stream()
			.anyMatch(m -> m.isAnnotationPresent(Observed.class)
					&& m.getAnnotation(Observed.class).name().equals(expectedObservationName));
		assertThat(hasObserved)
			.as("Expected @Observed(name=\"%s\") on %s.%s", expectedObservationName, clazz.getSimpleName(), methodName)
			.isTrue();
	}

}
