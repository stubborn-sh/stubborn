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
package sh.stubborn.oss.stubdownloader;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;

import sh.stubborn.contract.stubrunner.StubResource;

/**
 * Stubborn Contract {@link StubResource} wrapping a broker URL. Used to identify that the
 * stub repository root points to a Stubborn Broker instance.
 *
 * <p>
 * The broker URL is extracted by stripping the {@code stubborn://} prefix (or the legacy
 * {@code sccbroker://} alias) from the location string. For example,
 * {@code stubborn://http://localhost:18080} yields {@code http://localhost:18080}.
 */
public class BrokerResource implements StubResource {

	/**
	 * Primary protocol prefix used to point the stub runner at a Stubborn Broker.
	 */
	static final String PROTOCOL = "stubborn";

	/**
	 * Legacy protocol prefix, retained for backward compatibility with existing
	 * {@code repositoryRoot = "sccbroker://..."} configuration.
	 */
	static final String LEGACY_PROTOCOL = "sccbroker";

	private final String brokerUrl;

	BrokerResource(String location) {
		this.brokerUrl = stripProtocol(location);
	}

	/**
	 * Whether the given location targets a Stubborn Broker (either the primary
	 * {@code stubborn://} protocol or the legacy {@code sccbroker://} alias).
	 * @param location the stub repository root location
	 * @return {@code true} if the location uses a broker protocol
	 */
	static boolean isBrokerLocation(String location) {
		return location.startsWith(PROTOCOL + "://") || location.startsWith(LEGACY_PROTOCOL + "://");
	}

	private static String stripProtocol(String location) {
		if (location.startsWith(PROTOCOL + "://")) {
			return location.substring((PROTOCOL + "://").length());
		}
		if (location.startsWith(LEGACY_PROTOCOL + "://")) {
			return location.substring((LEGACY_PROTOCOL + "://").length());
		}
		return location;
	}

	/**
	 * Returns the broker base URL (without the protocol prefix).
	 * @return the broker HTTP URL
	 */
	public String getBrokerUrl() {
		return this.brokerUrl;
	}

	@Override
	public String getDescription() {
		return "Stubborn Broker Resource [" + this.brokerUrl + "]";
	}

	@Override
	public InputStream getInputStream() {
		return new ByteArrayInputStream(this.brokerUrl.getBytes(StandardCharsets.UTF_8));
	}

	@Override
	public URI getURI() {
		return URI.create(this.brokerUrl);
	}

	@Override
	public URL getURL() throws IOException {
		return URI.create(this.brokerUrl).toURL();
	}

	@Override
	public File getFile() throws IOException {
		throw new IOException("Stubborn Broker resource is not backed by a file: " + this.brokerUrl);
	}

	@Override
	public String getFilename() {
		return this.brokerUrl;
	}

}
