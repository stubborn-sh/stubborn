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

package org.springframework.cloud.contract.verifier.openapivalidation;

import org.junit.jupiter.api.extension.ExtendWith;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Enables OpenAPI contract verification for JUnit 5 tests.
 *
 * @since 5.0.2
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@ExtendWith(OpenApiContractsVerifierExtension.class)
public @interface VerifyContractsAgainstOpenApi {

	/**
	 * OpenAPI spec path.
	 *
	 * @since 5.0.2
	 */
	String openApiSpec() default "";

	/**
	 * Contracts directory path.
	 *
	 * @since 5.0.2
	 */
	String contractsDir() default "";

}
