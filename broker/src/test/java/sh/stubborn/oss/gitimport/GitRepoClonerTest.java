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

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.eclipse.jgit.api.Git;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * @see <a href="../../../docs/specs/029-git-import.md">Spec 029 — Git Import</a>
 */
class GitRepoClonerTest {

	// Allow file:// scheme for local integration tests
	GitRepoCloner cloner = new GitRepoCloner(List.of("http", "https", "file"));

	@Test
	void should_clone_and_extract_contracts_from_local_http_repo(@TempDir Path tempDir) throws Exception {
		// given - create a bare Git repo with contract files
		Path repoDir = tempDir.resolve("test-repo");
		try (Git git = Git.init().setDirectory(repoDir.toFile()).setInitialBranch("main").call()) {
			Path contractsDir = repoDir.resolve("src/test/resources/contracts");
			Files.createDirectories(contractsDir);
			Files.writeString(contractsDir.resolve("shouldReturnOrder.json"), "{\"request\": {}}",
					StandardCharsets.UTF_8);
			Files.writeString(contractsDir.resolve("shouldCreateOrder.yml"), "request:\n  method: POST",
					StandardCharsets.UTF_8);
			Files.writeString(contractsDir.resolve("readme.txt"), "not a contract", StandardCharsets.UTF_8);

			git.add().addFilepattern(".").call();
			git.commit().setMessage("Initial commit").call();
		}

		// when - clone using file URI (URL scheme validation is tested separately)
		GitRepoCloner.CloneResult result = this.cloner.cloneAndExtract(repoDir.toUri().toString(), "main",
				"src/test/resources/contracts/", "NONE", null, null);

		// then
		assertThat(result.contracts()).hasSize(2);
		assertThat(result.contracts()).extracting(GitRepoCloner.ExtractedContract::contractName)
			.containsExactlyInAnyOrder("shouldReturnOrder.json", "shouldCreateOrder.yml");
		assertThat(result.contracts()).extracting(GitRepoCloner.ExtractedContract::content)
			.anyMatch(c -> c.contains("{\"request\": {}}"))
			.anyMatch(c -> c.contains("request:") && c.contains("method: POST"));
		assertThat(result.resolvedVersion()).hasSize(7); // abbreviated SHA
	}

	@Test
	void should_resolve_tag_as_version(@TempDir Path tempDir) throws Exception {
		// given
		Path repoDir = tempDir.resolve("tagged-repo");
		try (Git git = Git.init().setDirectory(repoDir.toFile()).setInitialBranch("main").call()) {
			Path contractsDir = repoDir.resolve("src/test/resources/contracts");
			Files.createDirectories(contractsDir);
			Files.writeString(contractsDir.resolve("contract.json"), "{}", StandardCharsets.UTF_8);

			git.add().addFilepattern(".").call();
			git.commit().setMessage("Initial commit").call();
			git.tag().setName("v1.0.0").call();
		}

		// when
		GitRepoCloner.CloneResult result = this.cloner.cloneAndExtract(repoDir.toUri().toString(), "main",
				"src/test/resources/contracts/", "NONE", null, null);

		// then
		assertThat(result.resolvedVersion()).isEqualTo("v1.0.0");
	}

	@Test
	void should_return_empty_when_contracts_directory_does_not_exist(@TempDir Path tempDir) throws Exception {
		// given
		Path repoDir = tempDir.resolve("empty-repo");
		try (Git git = Git.init().setDirectory(repoDir.toFile()).setInitialBranch("main").call()) {
			Files.writeString(repoDir.resolve("README.md"), "# test", StandardCharsets.UTF_8);
			git.add().addFilepattern(".").call();
			git.commit().setMessage("Initial commit").call();
		}

		// when
		GitRepoCloner.CloneResult result = this.cloner.cloneAndExtract(repoDir.toUri().toString(), "main",
				"src/test/resources/contracts/", "NONE", null, null);

		// then
		assertThat(result.contracts()).isEmpty();
	}

	@Test
	void should_extract_groovy_contracts(@TempDir Path tempDir) throws Exception {
		// given
		Path repoDir = tempDir.resolve("groovy-repo");
		try (Git git = Git.init().setDirectory(repoDir.toFile()).setInitialBranch("main").call()) {
			Path contractsDir = repoDir.resolve("src/test/resources/contracts");
			Files.createDirectories(contractsDir);
			Files.writeString(contractsDir.resolve("shouldWork.groovy"), "Contract.make {}", StandardCharsets.UTF_8);

			git.add().addFilepattern(".").call();
			git.commit().setMessage("Initial commit").call();
		}

		// when
		GitRepoCloner.CloneResult result = this.cloner.cloneAndExtract(repoDir.toUri().toString(), "main",
				"src/test/resources/contracts/", "NONE", null, null);

		// then
		assertThat(result.contracts()).hasSize(1);
		assertThat(result.contracts().get(0).contractName()).isEqualTo("shouldWork.groovy");
	}

	@Test
	void should_extract_nested_contracts(@TempDir Path tempDir) throws Exception {
		// given
		Path repoDir = tempDir.resolve("nested-repo");
		try (Git git = Git.init().setDirectory(repoDir.toFile()).setInitialBranch("main").call()) {
			Path contractsDir = repoDir.resolve("src/test/resources/contracts/orders/v1");
			Files.createDirectories(contractsDir);
			Files.writeString(contractsDir.resolve("getOrder.json"), "{}", StandardCharsets.UTF_8);

			git.add().addFilepattern(".").call();
			git.commit().setMessage("Initial commit").call();
		}

		// when
		GitRepoCloner.CloneResult result = this.cloner.cloneAndExtract(repoDir.toUri().toString(), "main",
				"src/test/resources/contracts/", "NONE", null, null);

		// then
		assertThat(result.contracts()).hasSize(1);
		assertThat(result.contracts().get(0).contractName()).isEqualTo("orders/v1/getOrder.json");
	}

	@Test
	void should_reject_file_url_scheme() {
		GitRepoCloner productionCloner = new GitRepoCloner();
		assertThatThrownBy(
				() -> productionCloner.cloneAndExtract("file:///etc/passwd", "main", "contracts/", "NONE", null, null))
			.isInstanceOf(GitImportException.class)
			.hasMessageContaining("only http/https allowed");
	}

	@Test
	void should_reject_null_url_scheme() {
		GitRepoCloner productionCloner = new GitRepoCloner();
		assertThatThrownBy(
				() -> productionCloner.cloneAndExtract("not-a-url", "main", "contracts/", "NONE", null, null))
			.isInstanceOf(GitImportException.class);
	}

	@Test
	void should_reject_path_traversal_in_contracts_directory(@TempDir Path tempDir) throws Exception {
		// given
		Path repoDir = tempDir.resolve("traversal-repo");
		try (Git git = Git.init().setDirectory(repoDir.toFile()).setInitialBranch("main").call()) {
			Path contractsDir = repoDir.resolve("contracts");
			Files.createDirectories(contractsDir);
			Files.writeString(contractsDir.resolve("test.yaml"), "test: true", StandardCharsets.UTF_8);
			git.add().addFilepattern(".").call();
			git.commit().setMessage("Initial commit").call();
		}

		// when/then — directory with .. should be rejected
		assertThatThrownBy(() -> this.cloner.cloneAndExtract(repoDir.toUri().toString(), "main", "../../../etc/",
				"NONE", null, null))
			.isInstanceOf(GitImportException.class)
			.hasMessageContaining("..");
	}

	@Test
	void should_reject_absolute_path_in_contracts_directory(@TempDir Path tempDir) throws Exception {
		// given
		Path repoDir = tempDir.resolve("abs-path-repo");
		try (Git git = Git.init().setDirectory(repoDir.toFile()).setInitialBranch("main").call()) {
			Path contractsDir = repoDir.resolve("contracts");
			Files.createDirectories(contractsDir);
			Files.writeString(contractsDir.resolve("test.yaml"), "test: true", StandardCharsets.UTF_8);
			git.add().addFilepattern(".").call();
			git.commit().setMessage("Initial commit").call();
		}

		// when/then — contracts directory with embedded .. should be rejected
		assertThatThrownBy(() -> this.cloner.cloneAndExtract(repoDir.toUri().toString(), "main",
				"contracts/../../sensitive/", "NONE", null, null))
			.isInstanceOf(GitImportException.class)
			.hasMessageContaining("..");
	}

	@Test
	void should_use_custom_contracts_directory(@TempDir Path tempDir) throws Exception {
		// given
		Path repoDir = tempDir.resolve("custom-dir-repo");
		try (Git git = Git.init().setDirectory(repoDir.toFile()).setInitialBranch("main").call()) {
			Path contractsDir = repoDir.resolve("custom/contracts");
			Files.createDirectories(contractsDir);
			Files.writeString(contractsDir.resolve("test.yaml"), "test: true", StandardCharsets.UTF_8);

			git.add().addFilepattern(".").call();
			git.commit().setMessage("Initial commit").call();
		}

		// when
		GitRepoCloner.CloneResult result = this.cloner.cloneAndExtract(repoDir.toUri().toString(), "main",
				"custom/contracts/", "NONE", null, null);

		// then
		assertThat(result.contracts()).hasSize(1);
		assertThat(result.contracts().get(0).contractName()).isEqualTo("test.yaml");
	}

	@Test
	void should_skip_files_exceeding_max_file_size(@TempDir Path tempDir) throws Exception {
		// given — create a repo with one normal contract and one oversized (>1 MB) file
		Path repoDir = tempDir.resolve("oversized-repo");
		try (Git git = Git.init().setDirectory(repoDir.toFile()).setInitialBranch("main").call()) {
			Path contractsDir = repoDir.resolve("contracts");
			Files.createDirectories(contractsDir);
			Files.writeString(contractsDir.resolve("small.json"), "{\"ok\":true}", StandardCharsets.UTF_8);
			// Create a file larger than 1 MB (MAX_FILE_SIZE)
			byte[] oversizedContent = new byte[1024 * 1024 + 1];
			java.util.Arrays.fill(oversizedContent, (byte) 'x');
			Files.write(contractsDir.resolve("huge.json"), oversizedContent);

			git.add().addFilepattern(".").call();
			git.commit().setMessage("Initial commit with oversized file").call();
		}

		// when
		GitRepoCloner.CloneResult result = this.cloner.cloneAndExtract(repoDir.toUri().toString(), "main", "contracts/",
				"NONE", null, null);

		// then — only the small file should be extracted; the oversized one is skipped
		assertThat(result.contracts()).hasSize(1);
		assertThat(result.contracts().get(0).contractName()).isEqualTo("small.json");
	}

	@Test
	void should_have_circuit_breaker_annotation_on_clone_method() throws Exception {
		// The @CircuitBreaker annotation is AOP-based and only activates in a
		// Spring context. This test verifies the annotation is present on the
		// cloneAndExtract method so that it takes effect when wired by Spring.
		java.lang.reflect.Method method = GitRepoCloner.class.getDeclaredMethod("cloneAndExtract", String.class,
				String.class, String.class, String.class, String.class, String.class);
		CircuitBreaker annotation = method.getAnnotation(CircuitBreaker.class);
		assertThat(annotation).as("@CircuitBreaker should be present on cloneAndExtract").isNotNull();
		assertThat(annotation.name()).isEqualTo("gitImport");
	}

}
