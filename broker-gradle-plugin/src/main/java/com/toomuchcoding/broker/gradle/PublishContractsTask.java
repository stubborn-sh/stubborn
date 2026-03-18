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

import com.toomuchcoding.broker.publisher.BrokerPublisher;
import com.toomuchcoding.broker.publisher.PublishSummary;
import org.gradle.api.DefaultTask;
import org.gradle.api.file.DirectoryProperty;
import org.gradle.api.provider.Property;
import org.gradle.api.tasks.Input;
import org.gradle.api.tasks.InputDirectory;
import org.gradle.api.tasks.Optional;
import org.gradle.api.tasks.PathSensitive;
import org.gradle.api.tasks.PathSensitivity;
import org.gradle.api.tasks.TaskAction;
import org.gradle.work.DisableCachingByDefault;

/**
 * Gradle task that publishes contract files to the SCC Broker.
 */
@DisableCachingByDefault(because = "Publishing contracts is a network operation that should always execute")
public abstract class PublishContractsTask extends DefaultTask {

	@Input
	public abstract Property<String> getBrokerUrl();

	@Input
	public abstract Property<String> getUsername();

	@Input
	public abstract Property<String> getPassword();

	@Input
	public abstract Property<String> getApplicationName();

	@Input
	public abstract Property<String> getApplicationVersion();

	@InputDirectory
	@PathSensitive(PathSensitivity.RELATIVE)
	public abstract DirectoryProperty getContractsDirectory();

	@Input
	@Optional
	public abstract Property<String> getAppDescription();

	@Input
	@Optional
	public abstract Property<String> getOwner();

	@TaskAction
	public void publish() {
		BrokerPublisher publisher = BrokerPublisher.create(getBrokerUrl().get(), getUsername().get(),
				getPassword().get());
		PublishSummary summary = publisher.publish(getApplicationName().get(), getApplicationVersion().get(),
				getContractsDirectory().get().getAsFile().toPath(), getAppDescription().getOrNull(),
				getOwner().getOrElse("unknown"));
		getLogger().lifecycle("Published {} contracts ({} skipped) for {}:{}", summary.publishedCount(),
				summary.skippedCount(), getApplicationName().get(), getApplicationVersion().get());
	}

}
