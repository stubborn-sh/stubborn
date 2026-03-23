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
package sh.stubborn.broker.security;

import java.time.Instant;
import java.util.Map;

import org.jspecify.annotations.Nullable;

public record ErrorResponse(String code, String message, String traceId, Instant timestamp,
		@Nullable Map<String, String> details) {

	public static ErrorResponse of(String code, String message, String traceId) {
		return new ErrorResponse(code, message, traceId, Instant.now(), null);
	}

	public static ErrorResponse of(String code, String message, String traceId, Map<String, String> details) {
		return new ErrorResponse(code, message, traceId, Instant.now(), details);
	}

}
