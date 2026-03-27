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

import java.util.Objects;

import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import sh.stubborn.oss.gitimport.GitImportException;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.micrometer.tracing.Span;
import io.micrometer.tracing.TraceContext;
import io.micrometer.tracing.Tracer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import sh.stubborn.oss.application.ApplicationAlreadyExistsException;
import sh.stubborn.oss.application.ApplicationNotFoundException;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.BeanPropertyBindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;

@ExtendWith(MockitoExtension.class)
class GlobalExceptionHandlerTest {

	@Mock
	Tracer tracer;

	@Mock
	Span span;

	@Mock
	TraceContext traceContext;

	@Test
	void should_return_trace_id_when_span_active() {
		// given
		given(this.tracer.currentSpan()).willReturn(this.span);
		given(this.span.context()).willReturn(this.traceContext);
		given(this.traceContext.traceId()).willReturn("abc-123-trace");
		GlobalExceptionHandler handler = new GlobalExceptionHandler(this.tracer);

		// when
		ResponseEntity<ErrorResponse> response = handler.handleNotFound(new ApplicationNotFoundException("test-app"));

		// then
		ErrorResponse body = Objects.requireNonNull(response.getBody());
		assertThat(body.traceId()).isEqualTo("abc-123-trace");
	}

	@Test
	void should_return_no_trace_when_no_current_span() {
		// given
		given(this.tracer.currentSpan()).willReturn(null);
		GlobalExceptionHandler handler = new GlobalExceptionHandler(this.tracer);

		// when
		ResponseEntity<ErrorResponse> response = handler.handleNotFound(new ApplicationNotFoundException("test-app"));

		// then
		ErrorResponse body = Objects.requireNonNull(response.getBody());
		assertThat(body.traceId()).isEqualTo("no-trace");
	}

	@Test
	void should_return_no_trace_when_span_context_null() {
		// given
		given(this.tracer.currentSpan()).willReturn(this.span);
		given(this.span.context()).willReturn(null);
		GlobalExceptionHandler handler = new GlobalExceptionHandler(this.tracer);

		// when
		ResponseEntity<ErrorResponse> response = handler.handleNotFound(new ApplicationNotFoundException("test-app"));

		// then
		ErrorResponse body = Objects.requireNonNull(response.getBody());
		assertThat(body.traceId()).isEqualTo("no-trace");
	}

	@Test
	void should_handle_not_found_with_404() {
		// given
		given(this.tracer.currentSpan()).willReturn(null);
		GlobalExceptionHandler handler = new GlobalExceptionHandler(this.tracer);

		// when
		ResponseEntity<ErrorResponse> response = handler
			.handleNotFound(new ApplicationNotFoundException("order-service"));

		// then
		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
		ErrorResponse body = Objects.requireNonNull(response.getBody());
		assertThat(body.code()).isEqualTo("APPLICATION_NOT_FOUND");
		assertThat(body.message()).contains("order-service");
	}

	@Test
	void should_handle_conflict_with_409() {
		// given
		given(this.tracer.currentSpan()).willReturn(null);
		GlobalExceptionHandler handler = new GlobalExceptionHandler(this.tracer);

		// when
		ResponseEntity<ErrorResponse> response = handler
			.handleConflict(new ApplicationAlreadyExistsException("order-service"));

		// then
		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
		ErrorResponse body = Objects.requireNonNull(response.getBody());
		assertThat(body.code()).isEqualTo("APPLICATION_ALREADY_EXISTS");
	}

	@Test
	void should_handle_validation_with_field_errors() {
		// given
		given(this.tracer.currentSpan()).willReturn(null);
		GlobalExceptionHandler handler = new GlobalExceptionHandler(this.tracer);
		BeanPropertyBindingResult bindingResult = new BeanPropertyBindingResult(new Object(), "request");
		bindingResult.addError(new FieldError("request", "name", "must not be blank"));
		bindingResult.addError(new FieldError("request", "version", "invalid input"));
		MethodArgumentNotValidException ex = new MethodArgumentNotValidException(mock(MethodParameter.class),
				bindingResult);

		// when
		ResponseEntity<ErrorResponse> response = handler.handleValidation(ex);

		// then
		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
		ErrorResponse body = Objects.requireNonNull(response.getBody());
		assertThat(body.code()).isEqualTo("VALIDATION_ERROR");
		assertThat(body.details()).containsEntry("name", "must not be blank");
		assertThat(body.details()).containsEntry("version", "invalid input");
	}

	@Test
	void should_handle_validation_with_null_default_message() {
		// given
		given(this.tracer.currentSpan()).willReturn(null);
		GlobalExceptionHandler handler = new GlobalExceptionHandler(this.tracer);
		BeanPropertyBindingResult bindingResult = new BeanPropertyBindingResult(new Object(), "request");
		bindingResult.addError(new FieldError("request", "email", null, false, null, null, null));
		MethodArgumentNotValidException ex = new MethodArgumentNotValidException(mock(MethodParameter.class),
				bindingResult);

		// when
		ResponseEntity<ErrorResponse> response = handler.handleValidation(ex);

		// then
		ErrorResponse body = Objects.requireNonNull(response.getBody());
		assertThat(body.details()).containsEntry("email", "invalid");
	}

	@Test
	void should_handle_unexpected_error_with_500() {
		// given
		given(this.tracer.currentSpan()).willReturn(null);
		GlobalExceptionHandler handler = new GlobalExceptionHandler(this.tracer);

		// when
		ResponseEntity<ErrorResponse> response = handler.handleUnexpected(new RuntimeException("boom"));

		// then
		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
		ErrorResponse body = Objects.requireNonNull(response.getBody());
		assertThat(body.code()).isEqualTo("INTERNAL_ERROR");
		assertThat(body.message()).isEqualTo("An unexpected error occurred");
	}

	@Test
	void should_handle_illegal_argument_with_400() {
		// given
		given(this.tracer.currentSpan()).willReturn(null);
		GlobalExceptionHandler handler = new GlobalExceptionHandler(this.tracer);

		// when
		ResponseEntity<ErrorResponse> response = handler
			.handleIllegalArgument(new IllegalArgumentException("bad input"));

		// then
		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
		ErrorResponse body = Objects.requireNonNull(response.getBody());
		assertThat(body.code()).isEqualTo("VALIDATION_ERROR");
		assertThat(body.message()).isEqualTo("bad input");
	}

	@Test
	void should_handle_exception_with_null_message() {
		// given — exception whose getMessage() returns null should not cause NPE
		given(this.tracer.currentSpan()).willReturn(null);
		GlobalExceptionHandler handler = new GlobalExceptionHandler(this.tracer);
		// RuntimeException with no message — getMessage() returns null
		IllegalArgumentException ex = new IllegalArgumentException();

		// when
		ResponseEntity<ErrorResponse> response = handler.handleIllegalArgument(ex);

		// then — should use class name as fallback, not NPE
		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
		ErrorResponse body = Objects.requireNonNull(response.getBody());
		assertThat(body.code()).isEqualTo("VALIDATION_ERROR");
		assertThat(body.message()).isEqualTo("IllegalArgumentException");
	}

	@Test
	void should_handle_circuit_breaker_open_with_503() {
		// given
		given(this.tracer.currentSpan()).willReturn(null);
		GlobalExceptionHandler handler = new GlobalExceptionHandler(this.tracer);
		CircuitBreaker circuitBreaker = CircuitBreaker.ofDefaults("database");
		CallNotPermittedException ex = CallNotPermittedException.createCallNotPermittedException(circuitBreaker);

		// when
		ResponseEntity<ErrorResponse> response = handler.handleCircuitBreakerOpen(ex);

		// then
		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
		ErrorResponse body = Objects.requireNonNull(response.getBody());
		assertThat(body.code()).isEqualTo("SERVICE_UNAVAILABLE");
		assertThat(body.message()).isEqualTo("Service temporarily unavailable, please retry later");
	}

}
