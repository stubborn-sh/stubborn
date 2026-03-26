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

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.parser.OpenAPIV3Parser;

import java.io.File;

class Oa3Parser {

	OpenAPI parseOpenAPI(File file) {
		var spec = new OpenAPIV3Parser().read(file.getPath());
		if (spec == null || spec.getPaths().isEmpty()) {
			throw new IllegalArgumentException("OpenAPI specification %s not found".formatted(file.getPath()));
		}
		return spec;
	}

}
