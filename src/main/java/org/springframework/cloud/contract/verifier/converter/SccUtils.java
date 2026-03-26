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

package org.springframework.cloud.contract.verifier.converter;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.function.Function;

import static org.apache.commons.lang3.StringUtils.isNotBlank;

class SccUtils {

	private static final Logger log = LoggerFactory.getLogger(SccUtils.class);

	private SccUtils() {
		throw new AssertionError("Utility class");
	}

	static YamlContract.MatchingType createMatchingType(String val) {
		return tryToParse(val, YamlContract.MatchingType::valueOf);
	}

	static YamlContract.PredefinedRegex createPredefinedRegex(String val) {
		return tryToParse(val, YamlContract.PredefinedRegex::valueOf);
	}

	static YamlContract.RegexType createRegexType(String val) {
		return tryToParse(val, YamlContract.RegexType::valueOf);
	}

	private static <T> T tryToParse(String val, Function<String, T> function) {
		if (isNotBlank(val)) {
			try {
				return function.apply(val);
			}
			catch (Exception e) {
				log.error("Error parsing value {}", val, e);
			}
		}
		return null;
	}

}
