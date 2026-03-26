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
package sh.stubborn.oss.maven;

import java.io.File;
import java.io.IOException;
import java.lang.reflect.Field;
import java.nio.file.Files;
import java.nio.file.Path;

import org.apache.maven.plugin.MojoExecutionException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PublishContractsMojoTest {

	@Test
	void should_skip_when_skip_is_true() throws Exception {
		// given
		PublishContractsMojo mojo = createMojo();
		setField(mojo, "skip", true);

		// when / then
		assertThatCode(mojo::execute).doesNotThrowAnyException();
	}

	@Test
	void should_not_fail_when_contracts_directory_does_not_exist() throws Exception {
		// given
		PublishContractsMojo mojo = createMojo();
		setField(mojo, "skip", false);
		setField(mojo, "contractsDirectory", new File("/nonexistent/path"));

		// when / then
		assertThatCode(mojo::execute).doesNotThrowAnyException();
	}

	@Test
	void should_throw_mojo_exception_when_broker_unreachable(@TempDir Path tempDir) throws Exception {
		// given — directory with contract file, but unreachable broker
		Files.writeString(tempDir.resolve("create-order.yaml"), "request: {}");
		PublishContractsMojo mojo = createMojo();
		setField(mojo, "skip", false);
		setField(mojo, "brokerUrl", "http://localhost:1");
		setField(mojo, "contractsDirectory", tempDir.toFile());

		// when / then
		assertThatThrownBy(mojo::execute).isInstanceOf(MojoExecutionException.class);
	}

	private static PublishContractsMojo createMojo() throws Exception {
		PublishContractsMojo mojo = new PublishContractsMojo();
		setField(mojo, "brokerUrl", "http://localhost:18080");
		setField(mojo, "username", "admin");
		setField(mojo, "password", "admin");
		setField(mojo, "applicationName", "test-app");
		setField(mojo, "applicationVersion", "1.0.0");
		setField(mojo, "contractsDirectory", new File("src/test/resources/contracts"));
		setField(mojo, "owner", "team");
		return mojo;
	}

	private static void setField(Object target, String name, Object value) throws Exception {
		Field field = target.getClass().getDeclaredField(name);
		field.setAccessible(true);
		field.set(target, value);
	}

}
