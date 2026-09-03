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
package sh.stubborn.oss.dependency;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import sh.stubborn.oss.application.ApplicationService;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class DependencyServiceTest {

	@Mock
	DependencyRepository dependencyRepository;

	@Mock
	ApplicationService applicationService;

	DependencyService dependencyService;

	UUID consumerId;

	UUID providerId;

	@BeforeEach
	void setUp() {
		this.dependencyService = new DependencyService(this.dependencyRepository, this.applicationService);
		this.consumerId = UUID.randomUUID();
		this.providerId = UUID.randomUUID();
	}

	@Test
	void should_store_a_newly_declared_dependency() {
		// given
		given(this.applicationService.findIdByName("consumer-a")).willReturn(this.consumerId);
		given(this.applicationService.findIdByName("provider-a")).willReturn(this.providerId);
		given(this.dependencyRepository.findByConsumerIdAndConsumerVersionAndProviderId(this.consumerId, "1.0.0",
				this.providerId))
			.willReturn(Optional.empty());
		given(this.dependencyRepository.save(any(Dependency.class)))
			.willAnswer((invocation) -> invocation.getArgument(0));

		// when
		DependencyInfo info = this.dependencyService.declare("consumer-a", "1.0.0", "provider-a",
				DependencySource.DECLARED);

		// then
		assertThat(info.consumerId()).isEqualTo(this.consumerId);
		assertThat(info.providerId()).isEqualTo(this.providerId);
		assertThat(info.source()).isEqualTo(DependencySource.DECLARED);
		verify(this.dependencyRepository).save(any(Dependency.class));
	}

	@Test
	void should_not_store_a_second_row_when_the_same_dependency_is_declared_again() {
		// given — a consumer resolving the same stubs on every build must not accumulate
		// rows, so re-declaring returns what is already stored
		given(this.applicationService.findIdByName("consumer-a")).willReturn(this.consumerId);
		given(this.applicationService.findIdByName("provider-a")).willReturn(this.providerId);
		Dependency existing = Dependency.create(this.consumerId, "1.0.0", this.providerId,
				DependencySource.STUB_DOWNLOAD);
		given(this.dependencyRepository.findByConsumerIdAndConsumerVersionAndProviderId(this.consumerId, "1.0.0",
				this.providerId))
			.willReturn(Optional.of(existing));

		// when
		DependencyInfo info = this.dependencyService.declare("consumer-a", "1.0.0", "provider-a",
				DependencySource.DECLARED);

		// then — the stored row wins, so source records how it was first learned of
		assertThat(info.source()).isEqualTo(DependencySource.STUB_DOWNLOAD);
		verify(this.dependencyRepository, never()).save(any(Dependency.class));
	}

	@Test
	void should_reject_an_application_depending_on_itself() {
		// given
		given(this.applicationService.findIdByName("consumer-a")).willReturn(this.consumerId);

		// when / then
		assertThatThrownBy(
				() -> this.dependencyService.declare("consumer-a", "1.0.0", "consumer-a", DependencySource.DECLARED))
			.isInstanceOf(SelfDependencyException.class)
			.hasMessageContaining("consumer-a");
		verify(this.dependencyRepository, never()).save(any(Dependency.class));
	}

	@Test
	void should_return_the_declared_consumers_of_a_provider() {
		// given
		given(this.dependencyRepository.findDistinctConsumerIdsByProviderId(this.providerId))
			.willReturn(List.of(this.consumerId));

		// when / then
		assertThat(this.dependencyService.findConsumerIdsByProviderId(this.providerId))
			.containsExactly(this.consumerId);
	}

}
