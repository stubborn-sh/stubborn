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

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;

/**
 * Default in-memory users for development and testing. NOT active in the "production"
 * profile — production deployments must configure an external identity provider
 * (LDAP/OAuth2/OIDC) via Spring Security's standard auto-configuration.
 */
@Configuration
@Profile("!production")
class UserConfig {

	@Bean
	UserDetailsService userDetailsService() {
		var reader = User.withDefaultPasswordEncoder().username("reader").password("reader").roles("READER").build();
		var publisher = User.withDefaultPasswordEncoder()
			.username("publisher")
			.password("publisher")
			.roles("PUBLISHER")
			.build();
		var admin = User.withDefaultPasswordEncoder().username("admin").password("admin").roles("ADMIN").build();
		return new InMemoryUserDetailsManager(reader, publisher, admin);
	}

}
