/*
 * Copyright 2026 the original author or authors.
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

/**
 * Spring Cloud Contract 5.x backward-compatibility layer for the Stubborn Broker stub
 * downloader.
 *
 * <p>
 * These types implement the legacy {@code org.springframework.cloud.contract.stubrunner}
 * SPI so that consumers that are still on Spring Cloud Contract 5.x can keep resolving
 * stubs from a Stubborn Broker via {@code stubborn://} or the original
 * {@code sccbroker://} protocol. They are discovered through
 * {@code META-INF/spring.factories}. New consumers on Stubborn Contract use the primary
 * implementation in the parent package instead.
 */
@NullMarked
package sh.stubborn.oss.stubdownloader.scc;

import org.jspecify.annotations.NullMarked;
