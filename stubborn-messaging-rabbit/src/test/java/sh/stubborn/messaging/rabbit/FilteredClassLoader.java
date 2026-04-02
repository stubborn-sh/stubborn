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
package sh.stubborn.messaging.rabbit;

/**
 * Test class loader that hides specific packages to test conditional configuration.
 */
class FilteredClassLoader extends ClassLoader {

	private final String[] hiddenPackages;

	FilteredClassLoader(String... hiddenPackages) {
		super(ClassLoader.getSystemClassLoader());
		this.hiddenPackages = hiddenPackages;
	}

	@Override
	protected Class<?> loadClass(String name, boolean resolve) throws ClassNotFoundException {
		for (String hidden : this.hiddenPackages) {
			if (name.startsWith(hidden)) {
				throw new ClassNotFoundException(name);
			}
		}
		return super.loadClass(name, resolve);
	}

}
