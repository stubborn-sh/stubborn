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
package sh.stubborn.oss.publisher;

/**
 * A contract file to be published to the broker.
 *
 * @param name contract name (filename without extension)
 * @param content file content
 * @param contentType broker content type (e.g.
 * {@code application/x-spring-cloud-contract+yaml})
 */
record ContractFile(String name, String content, String contentType) {
}
