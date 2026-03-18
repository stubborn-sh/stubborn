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
package com.toomuchcoding.broker.gradle;

import org.gradle.api.Plugin;
import org.gradle.api.Project;

/**
 * Gradle plugin that registers the {@code broker} extension and {@code publishContracts}
 * task for publishing contracts to the SCC Broker.
 */
public class BrokerPlugin implements Plugin<Project> {

	@Override
	public void apply(Project project) {
		BrokerExtension extension = project.getExtensions().create("broker", BrokerExtension.class);
		project.getTasks().register("publishContracts", PublishContractsTask.class, task -> {
			task.setDescription("Publishes contracts to the SCC Broker");
			task.setGroup("verification");
			task.getBrokerUrl().convention(extension.getBrokerUrl());
			task.getUsername().convention(extension.getUsername());
			task.getPassword().convention(extension.getPassword());
			task.getApplicationName()
				.convention(extension.getApplicationName().orElse(project.provider(project::getName)));
			task.getApplicationVersion()
				.convention(extension.getApplicationVersion()
					.orElse(project.provider(() -> project.getVersion().toString())));
			task.getContractsDirectory().convention(extension.getContractsDirectory());
			task.getAppDescription().convention(extension.getAppDescription());
			task.getOwner().convention(extension.getOwner());
		});
	}

}
