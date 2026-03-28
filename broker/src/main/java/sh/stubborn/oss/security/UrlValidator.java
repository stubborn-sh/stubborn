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
package sh.stubborn.oss.security;

import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;

/**
 * Validates URLs to prevent SSRF attacks by blocking requests to internal network
 * addresses.
 *
 * @see <a href="../../docs/specs/039-data-integrity.md">Spec 039 — Data Integrity</a>
 */
public final class UrlValidator {

	private UrlValidator() {
	}

	/**
	 * Validates that the given URL does not target internal network addresses. Throws
	 * {@link IllegalArgumentException} if the URL resolves to a blocked address.
	 * @param url the URL to validate
	 */
	public static void validateExternalUrl(String url) {
		URI uri = URI.create(url);
		String host = uri.getHost();
		if (host == null) {
			throw new IllegalArgumentException("URL has no host: " + url);
		}

		// Strip IPv6 brackets if present
		String cleanHost = host.startsWith("[") && host.endsWith("]") ? host.substring(1, host.length() - 1) : host;

		// Check hostname-based blocklist
		if ("localhost".equalsIgnoreCase(cleanHost)) {
			throw new IllegalArgumentException("URL targets a blocked internal address: " + host);
		}

		try {
			InetAddress[] addresses = InetAddress.getAllByName(cleanHost);
			for (InetAddress address : addresses) {
				if (isBlockedAddress(address)) {
					throw new IllegalArgumentException("URL targets a blocked internal address: " + host);
				}
			}
		}
		catch (UnknownHostException ex) {
			// Cannot resolve — allow it through (the downstream call will fail naturally)
		}
	}

	private static boolean isBlockedAddress(InetAddress address) {
		return address.isLoopbackAddress() || address.isSiteLocalAddress() || address.isLinkLocalAddress()
				|| address.isAnyLocalAddress();
	}

}
