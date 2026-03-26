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

import javax.inject.Inject;

import org.gradle.api.file.DirectoryProperty;
import org.gradle.api.file.ProjectLayout;
import org.gradle.api.model.ObjectFactory;
import org.gradle.api.provider.Property;

/**
 * DSL extension for configuring the broker plugin.
 *
 * <pre>{@code
 * broker {
 *     brokerUrl = 'http://localhost:8080'
 *     username = 'admin'
 *     password = 'admin'
 *     applicationName = 'my-app'
 *     applicationVersion = '1.0.0'
 *     contractsDirectory = file('src/test/resources/contracts')
 * }
 * }</pre>
 */
public abstract class BrokerExtension {

	public abstract Property<String> getBrokerUrl();

	public abstract Property<String> getUsername();

	public abstract Property<String> getPassword();

	public abstract Property<String> getApplicationName();

	public abstract Property<String> getApplicationVersion();

	public abstract DirectoryProperty getContractsDirectory();

	/** Application description (named 'appDescription' to avoid conflict with Task). */
	public abstract Property<String> getAppDescription();

	public abstract Property<String> getOwner();

	@Inject
	public BrokerExtension(ObjectFactory objects, ProjectLayout layout) {
		getUsername().convention("admin");
		getPassword().convention("admin");
		getContractsDirectory().convention(layout.getProjectDirectory().dir("src/test/resources/contracts"));
		getOwner().convention("unknown");
	}

}
