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
package sh.stubborn.broker.verification;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import sh.stubborn.broker.application.ApplicationNotFoundException;
import sh.stubborn.broker.application.ApplicationService;
import sh.stubborn.broker.webhook.BrokerEvent;
import sh.stubborn.broker.webhook.EventType;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.never;

@ExtendWith(MockitoExtension.class)
class VerificationServiceTest {

	@Mock
	VerificationRepository verificationRepository;

	@Mock
	ApplicationService applicationService;

	@Mock
	ApplicationEventPublisher eventPublisher;

	VerificationService verificationService;

	UUID providerId;

	UUID consumerId;

	@BeforeEach
	void setUp() {
		VerificationMatcher verificationMatcher = new DirectVerificationMatcher(this.verificationRepository);
		this.verificationService = new VerificationService(this.verificationRepository, this.applicationService,
				this.eventPublisher, verificationMatcher);
		this.providerId = UUID.randomUUID();
		this.consumerId = UUID.randomUUID();
	}

	@Test
	void should_record_verification_when_valid() {
		// given
		given(this.applicationService.findIdByName("order-service")).willReturn(this.providerId);
		given(this.applicationService.findIdByName("payment-service")).willReturn(this.consumerId);
		given(this.verificationRepository.existsByProviderIdAndProviderVersionAndConsumerIdAndConsumerVersion(any(),
				any(), any(), any()))
			.willReturn(false);
		given(this.verificationRepository.save(any(Verification.class)))
			.willAnswer(invocation -> invocation.getArgument(0));

		// when
		Verification result = this.verificationService.record("order-service", "1.0.0", "payment-service", "2.0.0",
				"SUCCESS", null);

		// then
		assertThat(result.getProviderVersion()).isEqualTo("1.0.0");
		assertThat(result.getConsumerVersion()).isEqualTo("2.0.0");
		assertThat(result.getStatus()).isEqualTo(VerificationStatus.SUCCESS);
		then(this.verificationRepository).should().save(any(Verification.class));
	}

	@Test
	void should_throw_when_provider_not_found() {
		// given
		given(this.applicationService.findIdByName("unknown")).willThrow(new ApplicationNotFoundException("unknown"));

		// when/then
		assertThatThrownBy(
				() -> this.verificationService.record("unknown", "1.0.0", "consumer", "1.0.0", "SUCCESS", null))
			.isInstanceOf(ApplicationNotFoundException.class);
	}

	@Test
	void should_throw_when_consumer_not_found() {
		// given
		given(this.applicationService.findIdByName("order-service")).willReturn(this.providerId);
		given(this.applicationService.findIdByName("unknown")).willThrow(new ApplicationNotFoundException("unknown"));

		// when/then
		assertThatThrownBy(
				() -> this.verificationService.record("order-service", "1.0.0", "unknown", "1.0.0", "SUCCESS", null))
			.isInstanceOf(ApplicationNotFoundException.class);
	}

	@Test
	void should_throw_when_duplicate_verification() {
		// given
		given(this.applicationService.findIdByName("order-service")).willReturn(this.providerId);
		given(this.applicationService.findIdByName("payment-service")).willReturn(this.consumerId);
		given(this.verificationRepository.existsByProviderIdAndProviderVersionAndConsumerIdAndConsumerVersion(
				eq(this.providerId), eq("1.0.0"), eq(this.consumerId), eq("2.0.0")))
			.willReturn(true);

		// when/then
		assertThatThrownBy(() -> this.verificationService.record("order-service", "1.0.0", "payment-service", "2.0.0",
				"SUCCESS", null))
			.isInstanceOf(VerificationAlreadyExistsException.class);
	}

	@Test
	void should_record_verification_with_branch() {
		// given
		given(this.applicationService.findIdByName("order-service")).willReturn(this.providerId);
		given(this.applicationService.findIdByName("payment-service")).willReturn(this.consumerId);
		given(this.verificationRepository.existsByProviderIdAndProviderVersionAndConsumerIdAndConsumerVersion(any(),
				any(), any(), any()))
			.willReturn(false);
		given(this.verificationRepository.save(any(Verification.class)))
			.willAnswer(invocation -> invocation.getArgument(0));

		// when
		Verification result = this.verificationService.record("order-service", "1.0.0", "payment-service", "2.0.0",
				"SUCCESS", null, "feature/payments");

		// then
		assertThat(result.getBranch()).isEqualTo("feature/payments");
		then(this.verificationRepository).should().save(any(Verification.class));
	}

	@Test
	void should_throw_when_version_is_invalid() {
		// when/then
		assertThatThrownBy(
				() -> this.verificationService.record("order-service", "bad", "payment", "1.0.0", "SUCCESS", null))
			.isInstanceOf(IllegalArgumentException.class);
	}

	@Test
	void should_find_verifications_by_provider_and_version() {
		// given
		given(this.applicationService.findIdByName("order-service")).willReturn(this.providerId);
		Verification v = Verification.create(this.providerId, "1.0.0", this.consumerId, "2.0.0",
				VerificationStatus.SUCCESS, null);
		given(this.verificationRepository.findByProviderIdAndProviderVersion(eq(this.providerId), eq("1.0.0")))
			.willReturn(List.of(v));

		// when
		List<Verification> result = this.verificationService.findByProviderAndVersion("order-service", "1.0.0");

		// then
		assertThat(result).hasSize(1);
	}

	@Test
	void should_find_verification_by_id() {
		// given
		UUID verificationId = UUID.randomUUID();
		Verification v = Verification.create(this.providerId, "1.0.0", this.consumerId, "2.0.0",
				VerificationStatus.SUCCESS, null);
		given(this.verificationRepository.findById(verificationId)).willReturn(Optional.of(v));

		// when
		Verification result = this.verificationService.findById(verificationId);

		// then
		assertThat(result.getStatus()).isEqualTo(VerificationStatus.SUCCESS);
	}

	@Test
	void should_throw_when_verification_not_found_by_id() {
		// given
		UUID verificationId = UUID.randomUUID();
		given(this.verificationRepository.findById(verificationId)).willReturn(Optional.empty());

		// when/then
		assertThatThrownBy(() -> this.verificationService.findById(verificationId))
			.isInstanceOf(VerificationNotFoundException.class);
	}

	@Test
	void should_find_all_verifications() {
		// given
		Verification v = Verification.create(this.providerId, "1.0.0", this.consumerId, "2.0.0",
				VerificationStatus.SUCCESS, null);
		given(this.verificationRepository.findAll()).willReturn(List.of(v));

		// when
		List<Verification> result = this.verificationService.findAll();

		// then
		assertThat(result).hasSize(1);
	}

	@Test
	void should_find_all_verifications_paginated() {
		// given
		Verification v = Verification.create(this.providerId, "1.0.0", this.consumerId, "2.0.0",
				VerificationStatus.SUCCESS, null);
		Page<Verification> page = new PageImpl<>(List.of(v));
		given(this.verificationRepository.findAll(any(PageRequest.class))).willReturn(page);

		// when
		Page<Verification> result = this.verificationService.findAll(PageRequest.of(0, 10));

		// then
		assertThat(result.getContent()).hasSize(1);
	}

	@Test
	void should_search_verifications_by_term() {
		// given
		Verification v = Verification.create(this.providerId, "1.0.0", this.consumerId, "2.0.0",
				VerificationStatus.SUCCESS, null);
		Page<Verification> page = new PageImpl<>(List.of(v));
		given(this.verificationRepository.searchByProviderOrConsumer(eq("order"), any(PageRequest.class)))
			.willReturn(page);

		// when
		Page<Verification> result = this.verificationService.findAll("order", PageRequest.of(0, 10));

		// then
		assertThat(result.getContent()).hasSize(1);
		then(this.verificationRepository).should().searchByProviderOrConsumer(eq("order"), any(PageRequest.class));
	}

	@Test
	void should_find_all_verifications_paginated_when_search_blank() {
		// given
		Verification v = Verification.create(this.providerId, "1.0.0", this.consumerId, "2.0.0",
				VerificationStatus.SUCCESS, null);
		Page<Verification> page = new PageImpl<>(List.of(v));
		given(this.verificationRepository.findAll(any(PageRequest.class))).willReturn(page);

		// when
		Page<Verification> result = this.verificationService.findAll("  ", PageRequest.of(0, 10));

		// then
		assertThat(result.getContent()).hasSize(1);
		then(this.verificationRepository).should().findAll(any(PageRequest.class));
	}

	@Test
	void should_find_paginated_by_provider_and_version() {
		// given
		given(this.applicationService.findIdByName("order-service")).willReturn(this.providerId);
		Verification v = Verification.create(this.providerId, "1.0.0", this.consumerId, "2.0.0",
				VerificationStatus.SUCCESS, null);
		Page<Verification> page = new PageImpl<>(List.of(v));
		given(this.verificationRepository.findByProviderIdAndProviderVersion(eq(this.providerId), eq("1.0.0"),
				any(PageRequest.class)))
			.willReturn(page);

		// when
		Page<Verification> result = this.verificationService.findByProviderAndVersion("order-service", "1.0.0",
				PageRequest.of(0, 10));

		// then
		assertThat(result.getContent()).hasSize(1);
	}

	@Test
	void should_check_successful_verification() {
		// given
		given(this.verificationRepository.existsByProviderIdAndProviderVersionAndConsumerIdAndConsumerVersionAndStatus(
				eq(this.providerId), eq("1.0.0"), eq(this.consumerId), eq("2.0.0"), eq(VerificationStatus.SUCCESS)))
			.willReturn(true);

		// when
		boolean result = this.verificationService.hasSuccessfulVerification(this.providerId, "1.0.0", this.consumerId,
				"2.0.0");

		// then
		assertThat(result).isTrue();
	}

	@Test
	void should_resolve_application_name() {
		// given
		given(this.applicationService.findNameById(this.providerId)).willReturn("order-service");

		// when
		String name = this.verificationService.resolveApplicationName(this.providerId);

		// then
		assertThat(name).isEqualTo("order-service");
	}

	@Test
	void should_find_info_by_provider_id() {
		// given
		Verification v = Verification.create(this.providerId, "1.0.0", this.consumerId, "2.0.0",
				VerificationStatus.SUCCESS, null);
		given(this.verificationRepository.findByProviderId(this.providerId)).willReturn(List.of(v));

		// when
		List<VerificationInfo> result = this.verificationService.findInfoByProviderId(this.providerId);

		// then
		assertThat(result).hasSize(1);
	}

	@Test
	void should_find_info_by_consumer_id() {
		// given
		Verification v = Verification.create(this.providerId, "1.0.0", this.consumerId, "2.0.0",
				VerificationStatus.SUCCESS, null);
		given(this.verificationRepository.findByConsumerId(this.consumerId)).willReturn(List.of(v));

		// when
		List<VerificationInfo> result = this.verificationService.findInfoByConsumerId(this.consumerId);

		// then
		assertThat(result).hasSize(1);
	}

	@Test
	void should_find_all_info() {
		// given
		Verification v = Verification.create(this.providerId, "1.0.0", this.consumerId, "2.0.0",
				VerificationStatus.SUCCESS, null);
		given(this.verificationRepository.findAll()).willReturn(List.of(v));

		// when
		List<VerificationInfo> result = this.verificationService.findAllInfo();

		// then
		assertThat(result).hasSize(1);
	}

	@Test
	void should_count_verifications() {
		// given
		given(this.verificationRepository.count()).willReturn(10L);

		// when
		long count = this.verificationService.count();

		// then
		assertThat(count).isEqualTo(10);
	}

	@Test
	void should_compute_success_ratio() {
		// given
		Verification success = Verification.create(this.providerId, "1.0.0", this.consumerId, "2.0.0",
				VerificationStatus.SUCCESS, null);
		Verification failed = Verification.create(this.providerId, "1.0.0", UUID.randomUUID(), "2.0.0",
				VerificationStatus.FAILED, "Test failed");
		given(this.verificationRepository.count()).willReturn(2L);
		given(this.verificationRepository.findAll()).willReturn(List.of(success, failed));

		// when
		double ratio = this.verificationService.computeSuccessRatio();

		// then
		assertThat(ratio).isEqualTo(0.5);
	}

	@Test
	void should_return_zero_success_ratio_when_empty() {
		// given
		given(this.verificationRepository.count()).willReturn(0L);

		// when
		double ratio = this.verificationService.computeSuccessRatio();

		// then
		assertThat(ratio).isEqualTo(0.0);
	}

	@Test
	void should_publish_verification_published_event_when_recording() {
		// given
		given(this.applicationService.findIdByName("order-service")).willReturn(this.providerId);
		given(this.applicationService.findIdByName("payment-service")).willReturn(this.consumerId);
		given(this.verificationRepository.existsByProviderIdAndProviderVersionAndConsumerIdAndConsumerVersion(any(),
				any(), any(), any()))
			.willReturn(false);
		given(this.verificationRepository.save(any(Verification.class)))
			.willAnswer(invocation -> invocation.getArgument(0));

		// when
		this.verificationService.record("order-service", "1.0.0", "payment-service", "2.0.0", "FAILED", null);

		// then
		then(this.eventPublisher).should()
			.publishEvent(argThat((BrokerEvent event) -> event.eventType() == EventType.VERIFICATION_PUBLISHED));
	}

	@Test
	void should_publish_verification_succeeded_event_when_status_is_success() {
		// given
		given(this.applicationService.findIdByName("order-service")).willReturn(this.providerId);
		given(this.applicationService.findIdByName("payment-service")).willReturn(this.consumerId);
		given(this.verificationRepository.existsByProviderIdAndProviderVersionAndConsumerIdAndConsumerVersion(any(),
				any(), any(), any()))
			.willReturn(false);
		given(this.verificationRepository.save(any(Verification.class)))
			.willAnswer(invocation -> invocation.getArgument(0));

		// when
		this.verificationService.record("order-service", "1.0.0", "payment-service", "2.0.0", "SUCCESS", null);

		// then
		then(this.eventPublisher).should()
			.publishEvent(argThat((BrokerEvent event) -> event.eventType() == EventType.VERIFICATION_SUCCEEDED));
		then(this.eventPublisher).should(never())
			.publishEvent(argThat((BrokerEvent event) -> event.eventType() == EventType.VERIFICATION_FAILED));
	}

	@Test
	void should_not_publish_verification_succeeded_event_when_status_is_failed() {
		// given
		given(this.applicationService.findIdByName("order-service")).willReturn(this.providerId);
		given(this.applicationService.findIdByName("payment-service")).willReturn(this.consumerId);
		given(this.verificationRepository.existsByProviderIdAndProviderVersionAndConsumerIdAndConsumerVersion(any(),
				any(), any(), any()))
			.willReturn(false);
		given(this.verificationRepository.save(any(Verification.class)))
			.willAnswer(invocation -> invocation.getArgument(0));

		// when
		this.verificationService.record("order-service", "1.0.0", "payment-service", "2.0.0", "FAILED", null);

		// then
		then(this.eventPublisher).should(never())
			.publishEvent(argThat((BrokerEvent event) -> event.eventType() == EventType.VERIFICATION_SUCCEEDED));
		then(this.eventPublisher).should()
			.publishEvent(argThat((BrokerEvent event) -> event.eventType() == EventType.VERIFICATION_FAILED));
	}

	@Test
	void should_return_false_when_no_successful_verification_exists() {
		// given
		given(this.verificationRepository.existsByProviderIdAndProviderVersionAndConsumerIdAndConsumerVersionAndStatus(
				eq(this.providerId), eq("1.0.0"), eq(this.consumerId), eq("2.0.0"), eq(VerificationStatus.SUCCESS)))
			.willReturn(false);

		// when
		boolean result = this.verificationService.hasSuccessfulVerification(this.providerId, "1.0.0", this.consumerId,
				"2.0.0");

		// then
		assertThat(result).isFalse();
	}

}
