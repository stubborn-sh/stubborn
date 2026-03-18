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
package com.toomuchcoding.broker.maven;

import java.io.File;

import com.toomuchcoding.broker.publisher.BrokerPublisher;
import org.apache.maven.plugin.AbstractMojo;
import org.apache.maven.plugin.MojoExecutionException;
import org.apache.maven.plugins.annotations.Mojo;
import org.apache.maven.plugins.annotations.Parameter;

/**
 * Publishes contract files from a directory to the SCC Broker REST API.
 */
@Mojo(name = "publish", requiresProject = true)
public class PublishContractsMojo extends AbstractMojo {

	@Parameter(property = "broker.url", required = true)
	private String brokerUrl;

	@Parameter(property = "broker.username", defaultValue = "admin")
	private String username;

	@Parameter(property = "broker.password", defaultValue = "admin")
	private String password;

	@Parameter(property = "broker.applicationName", defaultValue = "${project.artifactId}")
	private String applicationName;

	@Parameter(property = "broker.applicationVersion", defaultValue = "${project.version}")
	private String applicationVersion;

	@Parameter(property = "broker.contractsDirectory", defaultValue = "${project.basedir}/src/test/resources/contracts")
	private File contractsDirectory;

	@Parameter(property = "broker.description")
	private String description;

	@Parameter(property = "broker.owner", defaultValue = "unknown")
	private String owner;

	@Parameter(property = "broker.skip", defaultValue = "false")
	private boolean skip;

	@Override
	public void execute() throws MojoExecutionException {
		if (this.skip) {
			getLog().info("Skipping contract publishing (broker.skip=true)");
			return;
		}
		if (!this.contractsDirectory.isDirectory()) {
			getLog().warn("Contracts directory does not exist: " + this.contractsDirectory);
			return;
		}
		try {
			BrokerPublisher publisher = BrokerPublisher.create(this.brokerUrl, this.username, this.password);
			publisher.publish(this.applicationName, this.applicationVersion, this.contractsDirectory.toPath(),
					this.description, this.owner);
		}
		catch (Exception ex) {
			throw new MojoExecutionException("Failed to publish contracts to broker at " + this.brokerUrl, ex);
		}
	}

}
