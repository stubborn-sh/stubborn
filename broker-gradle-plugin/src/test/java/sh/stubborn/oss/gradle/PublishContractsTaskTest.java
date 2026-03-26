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
package sh.stubborn.oss.gradle;

import org.gradle.api.Project;
import org.gradle.testfixtures.ProjectBuilder;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertNotNull;

class PublishContractsTaskTest {

	@Test
	void should_register_publishContracts_task() {
		// given
		Project project = ProjectBuilder.builder().build();

		// when
		project.getPluginManager().apply("sh.stubborn.broker");

		// then
		assertNotNull(project.getTasks().findByName("publishContracts"));
	}

	@Test
	void should_register_broker_extension() {
		// given
		Project project = ProjectBuilder.builder().build();

		// when
		project.getPluginManager().apply("sh.stubborn.broker");

		// then
		assertNotNull(project.getExtensions().findByName("broker"));
	}

}
