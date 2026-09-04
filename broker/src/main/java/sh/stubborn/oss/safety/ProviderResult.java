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
package sh.stubborn.oss.safety;

/**
 * The outcome of checking a candidate deployment against one of the providers it calls,
 * as that provider is currently deployed to the target environment.
 *
 * @param provider the provider application name
 * @param providerVersion the version of the provider deployed to the environment
 * @param verified whether the candidate version has a successful verification against
 * that provider version
 */
public record ProviderResult(String provider, String providerVersion, boolean verified) {
}
