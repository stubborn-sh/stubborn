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
package sh.stubborn.broker.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
class SecurityConfig {

	@Bean
	SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
		return http.csrf(csrf -> csrf.disable())
			.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
			.authorizeHttpRequests(auth -> auth.requestMatchers("/actuator/health/**")
				.permitAll()
				.requestMatchers(HttpMethod.GET, "/api/v1/broker/info")
				.permitAll()
				.requestMatchers(HttpMethod.GET, "/api/v1/**")
				.hasAnyRole("READER", "PUBLISHER", "ADMIN")
				.requestMatchers(HttpMethod.POST, "/api/v1/applications")
				.hasRole("ADMIN")
				.requestMatchers(HttpMethod.DELETE, "/api/v1/applications/**")
				.hasRole("ADMIN")
				.requestMatchers(HttpMethod.POST, "/api/v1/environments")
				.hasRole("ADMIN")
				.requestMatchers(HttpMethod.PUT, "/api/v1/environments/{name}")
				.hasRole("ADMIN")
				.requestMatchers(HttpMethod.DELETE, "/api/v1/environments/{name}")
				.hasRole("ADMIN")
				.requestMatchers(HttpMethod.DELETE, "/api/v1/**")
				.hasAnyRole("PUBLISHER", "ADMIN")
				.requestMatchers(HttpMethod.POST, "/api/v1/**")
				.hasAnyRole("PUBLISHER", "ADMIN")
				.requestMatchers(HttpMethod.PUT, "/api/v1/**")
				.hasAnyRole("PUBLISHER", "ADMIN")
				.anyRequest()
				.permitAll())
			.httpBasic(basic -> basic.authenticationEntryPoint((request, response, authException) -> {
				response.setStatus(HttpStatus.UNAUTHORIZED.value());
				response.setContentType(MediaType.APPLICATION_JSON_VALUE);
				response.getWriter().write("{\"code\":\"UNAUTHORIZED\",\"message\":\"Authentication required\"}");
			}))
			.build();
	}

}
