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
package sh.stubborn.oss.gitimport;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

record ImportGitRequest(@NotBlank @Size(max = 256) String applicationName,
		@NotBlank @Size(max = 2048) String repositoryUrl, @Nullable @Size(max = 256) String branch,
		@Nullable @Size(max = 1024) String contractsDirectory, @Nullable @Size(max = 128) String version,
		@Nullable String authType, @Nullable String username, @Nullable String token) {
}
