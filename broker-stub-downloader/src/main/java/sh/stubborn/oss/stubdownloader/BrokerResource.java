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
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

import org.springframework.core.io.AbstractResource;

/**
 * Spring {@link org.springframework.core.io.Resource} wrapping a broker URL. Used to
 * identify that the stub repository root points to an SCC Broker instance.
 *
 * <p>
 * The broker URL is extracted by stripping the {@code sccbroker://} prefix from the
 * location string. For example, {@code sccbroker://http://localhost:18080} yields
 * {@code http://localhost:18080}.
 */
public class BrokerResource extends AbstractResource {

	static final String PROTOCOL = "sccbroker";

	private final String brokerUrl;

	BrokerResource(String location) {
		this.brokerUrl = location.substring((PROTOCOL + "://").length());
	}

	/**
	 * Returns the broker base URL (without the sccbroker:// prefix).
	 * @return the broker HTTP URL
	 */
	public String getBrokerUrl() {
		return this.brokerUrl;
	}

	@Override
	public String getDescription() {
		return "SCC Broker Resource [" + this.brokerUrl + "]";
	}

	@Override
	public InputStream getInputStream() {
		return new ByteArrayInputStream(this.brokerUrl.getBytes(StandardCharsets.UTF_8));
	}

}
