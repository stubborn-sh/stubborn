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
package sh.stubborn.oss.security;

import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.micrometer.tracing.Tracer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import sh.stubborn.oss.application.ApplicationAlreadyExistsException;
import sh.stubborn.oss.application.ApplicationNotFoundException;
import sh.stubborn.oss.contract.ContractAlreadyExistsException;
import sh.stubborn.oss.contract.ContractNotFoundException;
import sh.stubborn.oss.environment.DeploymentNotFoundException;
import sh.stubborn.oss.environment.EnvironmentAlreadyExistsException;
import sh.stubborn.oss.environment.EnvironmentNotFoundException;
import sh.stubborn.oss.verification.VerificationAlreadyExistsException;
import sh.stubborn.oss.verification.VerificationNotFoundException;
import sh.stubborn.oss.tag.TagNotFoundException;
import sh.stubborn.oss.gitimport.GitImportException;
import sh.stubborn.oss.gitimport.GitImportSourceNotFoundException;
import sh.stubborn.oss.mavenimport.MavenImportException;
import sh.stubborn.oss.mavenimport.MavenImportSourceNotFoundException;
import sh.stubborn.oss.webhook.WebhookNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
@SuppressWarnings("PMD.TooManyMethods") // Central handler — one method per exception type
public class GlobalExceptionHandler {

	private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

	private final Tracer tracer;

	public GlobalExceptionHandler(Tracer tracer) {
		this.tracer = tracer;
	}

	@ExceptionHandler(ApplicationNotFoundException.class)
	ResponseEntity<ErrorResponse> handleNotFound(ApplicationNotFoundException ex) {
		return ResponseEntity.status(HttpStatus.NOT_FOUND)
			.body(ErrorResponse.of("APPLICATION_NOT_FOUND", Objects.requireNonNull(ex.getMessage()), getTraceId()));
	}

	@ExceptionHandler(ApplicationAlreadyExistsException.class)
	ResponseEntity<ErrorResponse> handleConflict(ApplicationAlreadyExistsException ex) {
		return ResponseEntity.status(HttpStatus.CONFLICT)
			.body(ErrorResponse.of("APPLICATION_ALREADY_EXISTS", Objects.requireNonNull(ex.getMessage()),
					getTraceId()));
	}

	@ExceptionHandler(ContractNotFoundException.class)
	ResponseEntity<ErrorResponse> handleContractNotFound(ContractNotFoundException ex) {
		return ResponseEntity.status(HttpStatus.NOT_FOUND)
			.body(ErrorResponse.of("CONTRACT_NOT_FOUND", Objects.requireNonNull(ex.getMessage()), getTraceId()));
	}

	@ExceptionHandler(ContractAlreadyExistsException.class)
	ResponseEntity<ErrorResponse> handleContractConflict(ContractAlreadyExistsException ex) {
		return ResponseEntity.status(HttpStatus.CONFLICT)
			.body(ErrorResponse.of("CONTRACT_ALREADY_EXISTS", Objects.requireNonNull(ex.getMessage()), getTraceId()));
	}

	@ExceptionHandler(VerificationNotFoundException.class)
	ResponseEntity<ErrorResponse> handleVerificationNotFound(VerificationNotFoundException ex) {
		return ResponseEntity.status(HttpStatus.NOT_FOUND)
			.body(ErrorResponse.of("VERIFICATION_NOT_FOUND", Objects.requireNonNull(ex.getMessage()), getTraceId()));
	}

	@ExceptionHandler(VerificationAlreadyExistsException.class)
	ResponseEntity<ErrorResponse> handleVerificationConflict(VerificationAlreadyExistsException ex) {
		return ResponseEntity.status(HttpStatus.CONFLICT)
			.body(ErrorResponse.of("VERIFICATION_ALREADY_EXISTS", Objects.requireNonNull(ex.getMessage()),
					getTraceId()));
	}

	@ExceptionHandler(DeploymentNotFoundException.class)
	ResponseEntity<ErrorResponse> handleDeploymentNotFound(DeploymentNotFoundException ex) {
		return ResponseEntity.status(HttpStatus.NOT_FOUND)
			.body(ErrorResponse.of("DEPLOYMENT_NOT_FOUND", Objects.requireNonNull(ex.getMessage()), getTraceId()));
	}

	@ExceptionHandler(EnvironmentNotFoundException.class)
	ResponseEntity<ErrorResponse> handleEnvironmentNotFound(EnvironmentNotFoundException ex) {
		return ResponseEntity.status(HttpStatus.NOT_FOUND)
			.body(ErrorResponse.of("ENVIRONMENT_NOT_FOUND", Objects.requireNonNull(ex.getMessage()), getTraceId()));
	}

	@ExceptionHandler(EnvironmentAlreadyExistsException.class)
	ResponseEntity<ErrorResponse> handleEnvironmentConflict(EnvironmentAlreadyExistsException ex) {
		return ResponseEntity.status(HttpStatus.CONFLICT)
			.body(ErrorResponse.of("ENVIRONMENT_ALREADY_EXISTS", Objects.requireNonNull(ex.getMessage()),
					getTraceId()));
	}

	@ExceptionHandler(WebhookNotFoundException.class)
	ResponseEntity<ErrorResponse> handleWebhookNotFound(WebhookNotFoundException ex) {
		return ResponseEntity.status(HttpStatus.NOT_FOUND)
			.body(ErrorResponse.of("WEBHOOK_NOT_FOUND", Objects.requireNonNull(ex.getMessage()), getTraceId()));
	}

	@ExceptionHandler(TagNotFoundException.class)
	ResponseEntity<ErrorResponse> handleTagNotFound(TagNotFoundException ex) {
		return ResponseEntity.status(HttpStatus.NOT_FOUND)
			.body(ErrorResponse.of("TAG_NOT_FOUND", Objects.requireNonNull(ex.getMessage()), getTraceId()));
	}

	@ExceptionHandler(GitImportSourceNotFoundException.class)
	ResponseEntity<ErrorResponse> handleGitImportSourceNotFound(GitImportSourceNotFoundException ex) {
		return ResponseEntity.status(HttpStatus.NOT_FOUND)
			.body(ErrorResponse.of("GIT_IMPORT_SOURCE_NOT_FOUND", Objects.requireNonNull(ex.getMessage()),
					getTraceId()));
	}

	@ExceptionHandler(GitImportException.class)
	ResponseEntity<ErrorResponse> handleGitImportException(GitImportException ex) {
		return ResponseEntity.status(HttpStatus.BAD_REQUEST)
			.body(ErrorResponse.of("GIT_IMPORT_ERROR", Objects.requireNonNull(ex.getMessage()), getTraceId()));
	}

	@ExceptionHandler(MavenImportSourceNotFoundException.class)
	ResponseEntity<ErrorResponse> handleMavenImportSourceNotFound(MavenImportSourceNotFoundException ex) {
		return ResponseEntity.status(HttpStatus.NOT_FOUND)
			.body(ErrorResponse.of("IMPORT_SOURCE_NOT_FOUND", Objects.requireNonNull(ex.getMessage()), getTraceId()));
	}

	@ExceptionHandler(MavenImportException.class)
	ResponseEntity<ErrorResponse> handleMavenImportException(MavenImportException ex) {
		return ResponseEntity.status(HttpStatus.BAD_REQUEST)
			.body(ErrorResponse.of("MAVEN_IMPORT_ERROR", Objects.requireNonNull(ex.getMessage()), getTraceId()));
	}

	@ExceptionHandler(CallNotPermittedException.class)
	ResponseEntity<ErrorResponse> handleCircuitBreakerOpen(CallNotPermittedException ex) {
		log.warn("Circuit breaker open: {}", ex.getMessage());
		return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
			.body(ErrorResponse.of("SERVICE_UNAVAILABLE", "Service temporarily unavailable, please retry later",
					getTraceId()));
	}

	@ExceptionHandler(IllegalArgumentException.class)
	ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException ex) {
		return ResponseEntity.status(HttpStatus.BAD_REQUEST)
			.body(ErrorResponse.of("VALIDATION_ERROR", Objects.requireNonNull(ex.getMessage()), getTraceId()));
	}

	@ExceptionHandler(MissingServletRequestParameterException.class)
	ResponseEntity<ErrorResponse> handleMissingParam(MissingServletRequestParameterException ex) {
		return ResponseEntity.status(HttpStatus.BAD_REQUEST)
			.body(ErrorResponse.of("VALIDATION_ERROR", Objects.requireNonNull(ex.getMessage()), getTraceId()));
	}

	@ExceptionHandler(MethodArgumentNotValidException.class)
	ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
		Map<String, String> fieldErrors = ex.getBindingResult()
			.getFieldErrors()
			.stream()
			.collect(Collectors.toMap(e -> e.getField(),
					e -> e.getDefaultMessage() != null ? e.getDefaultMessage() : "invalid", (a, b) -> a));
		return ResponseEntity.status(HttpStatus.BAD_REQUEST)
			.body(ErrorResponse.of("VALIDATION_ERROR", "Invalid request", getTraceId(), fieldErrors));
	}

	@ExceptionHandler(Exception.class)
	ResponseEntity<ErrorResponse> handleUnexpected(Exception ex) {
		log.error("Unexpected error", ex);
		return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
			.body(ErrorResponse.of("INTERNAL_ERROR", "An unexpected error occurred", getTraceId()));
	}

	private String getTraceId() {
		if (this.tracer.currentSpan() != null && this.tracer.currentSpan().context() != null) {
			return this.tracer.currentSpan().context().traceId();
		}
		return "no-trace";
	}

}
