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
package org.springframework.test.context.transaction;

import org.springframework.test.context.TestContext;
import org.springframework.test.context.support.AbstractTestExecutionListener;

/**
 * Clears stale {@link TransactionContext} leaked via {@code InheritableThreadLocal} when
 * JUnit 5 runs test classes in parallel using a ForkJoinPool.
 *
 * <p>
 * {@link TransactionContextHolder} stores the current {@link TransactionContext} in a
 * {@link org.springframework.core.NamedInheritableThreadLocal}. When a
 * {@code @DataJpaTest} (transactional) runs on a ForkJoinPool worker thread and the pool
 * later forks that worker, the child thread inherits the transaction context. If a
 * non-transactional E2E test subsequently runs on that child thread,
 * {@link TransactionalTestExecutionListener#beforeTestMethod} finds the stale context and
 * throws "Cannot start new transaction without ending existing transaction".
 *
 * <p>
 * This listener runs at order 3999 (just before
 * {@link TransactionalTestExecutionListener} at 4000) and silently removes any inherited
 * transaction context so the assertion in {@code TransactionalTestExecutionListener}
 * passes cleanly.
 *
 * @author Stubborn OSS
 */
public class ClearStaleTransactionContextListener extends AbstractTestExecutionListener {

	@Override
	public int getOrder() {
		return TransactionalTestExecutionListener.ORDER - 1;
	}

	@Override
	public void beforeTestMethod(TestContext testContext) {
		TransactionContextHolder.removeCurrentTransactionContext();
	}

}
