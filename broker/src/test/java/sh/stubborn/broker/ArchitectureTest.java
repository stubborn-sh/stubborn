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
package sh.stubborn.broker;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

@AnalyzeClasses(packages = "sh.stubborn.broker", importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureTest {

	@ArchTest
	static final ArchRule controllers_should_not_access_repositories = noClasses().that()
		.haveSimpleNameEndingWith("Controller")
		.should()
		.dependOnClassesThat()
		.haveSimpleNameEndingWith("Repository");

	@ArchTest
	static final ArchRule controllers_should_not_access_security_context_holder = noClasses().that()
		.haveSimpleNameEndingWith("Controller")
		.should()
		.dependOnClassesThat()
		.haveFullyQualifiedName("org.springframework.security.core.context.SecurityContextHolder");

	@ArchTest
	static final ArchRule entities_should_not_be_public = classes().that()
		.areAnnotatedWith(jakarta.persistence.Entity.class)
		.should()
		.notBePublic();

	@ArchTest
	static final ArchRule services_should_not_depend_on_controllers = noClasses().that()
		.haveSimpleNameEndingWith("Service")
		.should()
		.dependOnClassesThat()
		.haveSimpleNameEndingWith("Controller");

}
