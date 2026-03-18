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
package com.toomuchcoding.broker.publisher;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Public facade for publishing contracts to the SCC Broker. Scans a directory for
 * contract files and publishes each one via the broker REST API.
 *
 * <p>
 * Usage: <pre>{@code
 * BrokerPublisher publisher = BrokerPublisher.create("http://localhost:8080", "admin", "admin");
 * PublishSummary summary = publisher.publish("my-app", "1.0.0",
 *     Path.of("src/test/resources/contracts"), "My App", "team");
 * }</pre>
 */
public final class BrokerPublisher {

	private static final Logger log = LoggerFactory.getLogger(BrokerPublisher.class);

	private final BrokerContractPublisher delegate;

	private BrokerPublisher(BrokerContractPublisher delegate) {
		this.delegate = delegate;
	}

	/**
	 * Creates a new publisher targeting the given broker URL with HTTP Basic credentials.
	 * @param brokerUrl broker base URL (e.g. {@code http://localhost:8080})
	 * @param username HTTP Basic username
	 * @param password HTTP Basic password
	 * @return a configured publisher
	 */
	public static BrokerPublisher create(String brokerUrl, String username, String password) {
		return new BrokerPublisher(new BrokerContractPublisher(brokerUrl, username, password));
	}

	/**
	 * Publishes all contract files found in the given directory to the broker.
	 * Auto-registers the application if it does not already exist.
	 * @param applicationName broker application name
	 * @param applicationVersion version to publish contracts under
	 * @param contractsDirectory directory containing contract files
	 * @param description optional application description
	 * @param owner application owner
	 * @return summary of the publishing operation
	 */
	public PublishSummary publish(String applicationName, String applicationVersion, Path contractsDirectory,
			@Nullable String description, String owner) {
		log.info("Publishing contracts for {}:{} from {}", applicationName, applicationVersion, contractsDirectory);
		PublishResult appResult = this.delegate.registerApplication(applicationName, description, owner);
		List<ContractFile> contracts = scanContracts(contractsDirectory);
		if (contracts.isEmpty()) {
			log.warn("No contract files found in {}", contractsDirectory);
			return new PublishSummary(appResult, 0, 0, List.of());
		}
		int published = 0;
		int skipped = 0;
		List<String> names = new ArrayList<>();
		for (ContractFile contract : contracts) {
			names.add(contract.name());
			PublishResult result = this.delegate.publishContract(applicationName, applicationVersion, contract);
			if (result == PublishResult.CREATED) {
				published++;
			}
			else {
				skipped++;
			}
		}
		log.info("Published {} contracts ({} skipped) for {}:{}", published, skipped, applicationName,
				applicationVersion);
		return new PublishSummary(appResult, published, skipped, List.copyOf(names));
	}

	private static List<ContractFile> scanContracts(Path directory) {
		if (!Files.isDirectory(directory)) {
			log.warn("Contracts directory does not exist: {}", directory);
			return List.of();
		}
		List<ContractFile> contracts = new ArrayList<>();
		try (Stream<Path> walk = Files.walk(directory)) {
			walk.filter(Files::isRegularFile).sorted().forEach(file -> {
				String filename = file.getFileName().toString();
				String contentType = ContractContentType.fromExtension(filename);
				if (contentType != null) {
					try {
						String content = Files.readString(file);
						String name = ContractContentType.stripExtension(filename);
						contracts.add(new ContractFile(name, content, contentType));
					}
					catch (IOException ex) {
						throw new BrokerPublishException("Failed to read contract file: " + file, ex);
					}
				}
			});
		}
		catch (IOException ex) {
			throw new BrokerPublishException("Failed to scan contracts directory: " + directory, ex);
		}
		return contracts;
	}

}
