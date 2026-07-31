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
package sh.stubborn.oss.stubdownloader.scc;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

import org.springframework.core.io.AbstractResource;

/**
 * Spring Cloud Contract 5.x variant of the broker
 * {@link org.springframework.core.io.Resource}. Wraps a broker URL so the SCC stub runner
 * can recognise that the stub repository root points to a Stubborn Broker instance.
 *
 * <p>
 * The broker URL is extracted by stripping the {@code stubborn://} prefix (or the legacy
 * {@code sccbroker://} alias) from the location string. For example,
 * {@code stubborn://http://localhost:18080} yields {@code http://localhost:18080}.
 */
public class SccBrokerResource extends AbstractResource {

	static final String PROTOCOL = "stubborn";

	static final String LEGACY_PROTOCOL = "sccbroker";

	private final String brokerUrl;

	SccBrokerResource(String location) {
		this.brokerUrl = stripProtocol(location);
	}

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

}
