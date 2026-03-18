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

import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.util.Map;

import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

/**
 * Handles REST API calls to the broker for application registration and contract
 * publishing.
 */
class BrokerContractPublisher {

	private static final Logger log = LoggerFactory.getLogger(BrokerContractPublisher.class);

	private static final MediaType JSON_UTF8 = new MediaType("application", "json", StandardCharsets.UTF_8);

	private final RestClient restClient;

	BrokerContractPublisher(String brokerUrl, String username, String password) {
		HttpClient httpClient = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();
		this.restClient = RestClient.builder()
			.requestFactory(new JdkClientHttpRequestFactory(httpClient))
			.baseUrl(brokerUrl)
			.defaultHeaders(headers -> headers.setBasicAuth(username, password))
			.defaultStatusHandler(HttpStatusCode::isError, (req, res) -> {
				// handled per-request below
			})
			.build();
	}

	@SuppressWarnings("rawtypes")
	PublishResult registerApplication(String appName, @Nullable String description, String owner) {
		try {
			ResponseEntity<Map> response = this.restClient.post()
				.uri("/api/v1/applications")
				.contentType(JSON_UTF8)
				.body(Map.of("name", appName, "description", (description != null) ? description : "", "owner", owner))
				.retrieve()
				.toEntity(Map.class);
			int status = response.getStatusCode().value();
			if (status == 201) {
				log.info("Registered application '{}'", appName);
				return PublishResult.CREATED;
			}
			if (status == 409) {
				log.info("Application '{}' already exists", appName);
				return PublishResult.ALREADY_EXISTS;
			}
			if (status == 401) {
				throw new BrokerAuthenticationException(
						"Authentication failed when registering application '" + appName + "'");
			}
			throw new BrokerPublishException("Failed to register application '" + appName + "': HTTP " + status);
		}
		catch (ResourceAccessException ex) {
			throw new BrokerConnectionException("Cannot connect to broker to register application '" + appName + "'",
					ex);
		}
	}

	@SuppressWarnings("rawtypes")
	PublishResult publishContract(String appName, String version, ContractFile contract) {
		try {
			ResponseEntity<Map> response = this.restClient.post()
				.uri("/api/v1/applications/{app}/versions/{ver}/contracts", appName, version)
				.contentType(JSON_UTF8)
				.body(Map.of("contractName", contract.name(), "content", contract.content(), "contentType",
						contract.contentType()))
				.retrieve()
				.toEntity(Map.class);
			int status = response.getStatusCode().value();
			if (status == 201) {
				log.info("Published contract '{}' for {}:{}", contract.name(), appName, version);
				return PublishResult.CREATED;
			}
			if (status == 409) {
				log.info("Contract '{}' already exists for {}:{}", contract.name(), appName, version);
				return PublishResult.ALREADY_EXISTS;
			}
			if (status == 401) {
				throw new BrokerAuthenticationException(
						"Authentication failed when publishing contract '" + contract.name() + "'");
			}
			throw new BrokerPublishException("Failed to publish contract '" + contract.name() + "' for " + appName + ":"
					+ version + ": HTTP " + status);
		}
		catch (ResourceAccessException ex) {
			throw new BrokerConnectionException(
					"Cannot connect to broker to publish contract '" + contract.name() + "'", ex);
		}
	}

}
