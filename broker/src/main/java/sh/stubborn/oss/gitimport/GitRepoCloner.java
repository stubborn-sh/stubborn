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

import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.ArrayList;
import java.util.List;

import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.eclipse.jgit.api.CloneCommand;
import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.lib.ObjectId;
import org.eclipse.jgit.lib.Ref;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.transport.CredentialsProvider;
import org.eclipse.jgit.transport.UsernamePasswordCredentialsProvider;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.stereotype.Component;

@Component
class GitRepoCloner {

	private static final Logger logger = LoggerFactory.getLogger(GitRepoCloner.class);

	private static final int MAX_FILE_SIZE = 1024 * 1024; // 1 MB

	private static final List<String> DEFAULT_ALLOWED_SCHEMES = List.of("http", "https");

	private static final List<String> CONTRACT_EXTENSIONS = List.of(".yaml", ".yml", ".json", ".groovy");

	private final List<String> allowedSchemes;

	GitRepoCloner() {
		this.allowedSchemes = DEFAULT_ALLOWED_SCHEMES;
	}

	GitRepoCloner(List<String> allowedSchemes) {
		this.allowedSchemes = allowedSchemes;
	}

	@CircuitBreaker(name = "gitImport")
	CloneResult cloneAndExtract(String repositoryUrl, String branch, String contractsDirectory,
			@Nullable String authType, @Nullable String username, @Nullable String token) {
		validateUrl(repositoryUrl);

		Path tempDir = null;
		try {
			tempDir = Files.createTempDirectory("stubborn-git-import-");
			logger.info("Cloning {} (branch: {}) into {}", repositoryUrl, branch, tempDir);

			CloneCommand cloneCommand = Git.cloneRepository()
				.setURI(repositoryUrl)
				.setDirectory(tempDir.toFile())
				.setBranch(branch)
				.setDepth(1)
				.setNoCheckout(false);

			CredentialsProvider credentials = buildCredentials(authType, username, token);
			if (credentials != null) {
				cloneCommand.setCredentialsProvider(credentials);
			}

			try (Git git = cloneCommand.call()) {
				Repository repository = git.getRepository();

				String resolvedVersion = resolveVersion(repository);
				logger.info("Resolved version: {}", resolvedVersion);

				Path contractsPath = tempDir.resolve(normalizeDirectory(contractsDirectory)).normalize();
				if (!contractsPath.startsWith(tempDir)) {
					throw new GitImportException("Contracts directory escapes clone root: " + contractsDirectory);
				}
				List<ExtractedContract> contracts = extractContracts(contractsPath);

				logger.info("Extracted {} contract files from {}", contracts.size(), contractsPath);
				return new CloneResult(contracts, resolvedVersion);
			}
		}
		catch (GitImportException ex) {
			throw ex;
		}
		catch (Exception ex) {
			throw new GitImportException("Failed to clone repository %s: %s".formatted(repositoryUrl, ex.getMessage()),
					ex);
		}
		finally {
			if (tempDir != null) {
				deleteTempDir(tempDir);
			}
		}
	}

	private @Nullable CredentialsProvider buildCredentials(@Nullable String authType, @Nullable String username,
			@Nullable String token) {
		if (authType == null || "NONE".equals(authType)) {
			return null;
		}
		if ("HTTPS_TOKEN".equals(authType) && token != null) {
			return new UsernamePasswordCredentialsProvider(token, "");
		}
		if ("HTTPS_BASIC".equals(authType) && username != null && token != null) {
			return new UsernamePasswordCredentialsProvider(username, token);
		}
		return null;
	}

	private String resolveVersion(Repository repository) {
		try {
			ObjectId head = repository.resolve("HEAD");
			if (head == null) {
				return "unknown";
			}

			// Check for tag on HEAD
			for (Ref ref : repository.getRefDatabase().getRefsByPrefix("refs/tags/")) {
				ObjectId tagObject = ref.getPeeledObjectId() != null ? ref.getPeeledObjectId() : ref.getObjectId();
				if (head.equals(tagObject)) {
					String tagName = ref.getName().replace("refs/tags/", "");
					logger.debug("Found tag on HEAD: {}", tagName);
					return tagName;
				}
			}

			// Fall back to abbreviated commit SHA
			return head.abbreviate(7).name();
		}
		catch (IOException ex) {
			logger.warn("Failed to resolve version from Git: {}", ex.getMessage());
			return "unknown";
		}
	}

	private List<ExtractedContract> extractContracts(Path contractsPath) throws IOException {
		List<ExtractedContract> contracts = new ArrayList<>();

		if (!Files.isDirectory(contractsPath)) {
			logger.debug("Contracts directory does not exist: {}", contractsPath);
			return contracts;
		}

		Files.walkFileTree(contractsPath, new SimpleFileVisitor<>() {
			@Override
			public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
				String fileName = file.getFileName().toString();
				if (isContractFile(fileName) && attrs.size() <= MAX_FILE_SIZE) {
					String content = Files.readString(file, StandardCharsets.UTF_8);
					String relativeName = contractsPath.relativize(file).toString().replace('\\', '/');
					String contentType = fileName.endsWith(".json") ? "application/json" : "application/x-yaml";
					contracts.add(new ExtractedContract(relativeName, content, contentType));
				}
				else if (attrs.size() > MAX_FILE_SIZE) {
					logger.warn("Skipping oversized contract file: {} ({} bytes)", file, attrs.size());
				}
				return FileVisitResult.CONTINUE;
			}
		});

		return contracts;
	}

	private boolean isContractFile(String fileName) {
		String lower = fileName.toLowerCase();
		return CONTRACT_EXTENSIONS.stream().anyMatch(lower::endsWith);
	}

	private String normalizeDirectory(String directory) {
		// Reject path traversal attempts
		if (directory.contains("..")) {
			throw new GitImportException("Directory must not contain '..': " + directory);
		}
		// Remove leading slash if present
		String normalized = directory;
		if (normalized.startsWith("/")) {
			normalized = normalized.substring(1);
		}
		// Ensure no trailing slash for Path resolution
		if (normalized.endsWith("/")) {
			normalized = normalized.substring(0, normalized.length() - 1);
		}
		return normalized;
	}

	private void validateUrl(String url) {
		URI uri = URI.create(url);
		String scheme = uri.getScheme();
		if (scheme == null || !this.allowedSchemes.contains(scheme.toLowerCase())) {
			throw new GitImportException(
					"Invalid repository URL scheme: %s (only http/https allowed)".formatted(scheme));
		}
	}

	private void deleteTempDir(Path tempDir) {
		try {
			Files.walkFileTree(tempDir, new SimpleFileVisitor<>() {
				@Override
				public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
					Files.delete(file);
					return FileVisitResult.CONTINUE;
				}

				@Override
				public FileVisitResult postVisitDirectory(Path dir, IOException exc) throws IOException {
					Files.delete(dir);
					return FileVisitResult.CONTINUE;
				}
			});
		}
		catch (IOException ex) {
			logger.warn("Failed to clean up temp directory {}: {}", tempDir, ex.getMessage());
		}
	}

	record ExtractedContract(String contractName, String content, String contentType) {
	}

	record CloneResult(List<ExtractedContract> contracts, String resolvedVersion) {
	}

}
