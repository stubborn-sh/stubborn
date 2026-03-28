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

import java.util.Base64;

import javax.crypto.KeyGenerator;

import org.junit.jupiter.api.Test;

import org.springframework.core.env.Environment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;

class CredentialEncryptionServiceTest {

	private final Environment environment = createDefaultEnvironment();

	private static Environment createDefaultEnvironment() {
		Environment env = mock(Environment.class);
		given(env.getActiveProfiles()).willReturn(new String[0]);
		return env;
	}

	private static String generateBase64Key() throws Exception {
		KeyGenerator keyGen = KeyGenerator.getInstance("AES");
		keyGen.init(256);
		return Base64.getEncoder().encodeToString(keyGen.generateKey().getEncoded());
	}

	private CredentialEncryptionService createService(@org.jspecify.annotations.Nullable String key) {
		return new CredentialEncryptionService(key, this.environment);
	}

	@Test
	void should_encrypt_and_decrypt_roundtrip() throws Exception {
		// given
		String key = generateBase64Key();
		CredentialEncryptionService service = createService(key);
		String plaintext = "my-secret-password";

		// when
		String encrypted = service.encrypt(plaintext);
		String decrypted = service.decrypt(encrypted);

		// then
		assertThat(decrypted).isEqualTo(plaintext);
		assertThat(encrypted).isNotEqualTo(plaintext);
	}

	@Test
	void should_produce_different_ciphertexts_for_same_plaintext() throws Exception {
		// given
		String key = generateBase64Key();
		CredentialEncryptionService service = createService(key);
		String plaintext = "my-secret-password";

		// when
		String encrypted1 = service.encrypt(plaintext);
		String encrypted2 = service.encrypt(plaintext);

		// then — random IV means different ciphertexts each time
		assertThat(encrypted1).isNotEqualTo(encrypted2);

		// both must decrypt to the same plaintext
		assertThat(service.decrypt(encrypted1)).isEqualTo(plaintext);
		assertThat(service.decrypt(encrypted2)).isEqualTo(plaintext);
	}

	@Test
	void should_passthrough_when_key_is_empty() {
		// given
		CredentialEncryptionService service = createService("");
		String plaintext = "my-secret-password";

		// when
		String encrypted = service.encrypt(plaintext);
		String decrypted = service.decrypt(encrypted);

		// then
		assertThat(encrypted).isEqualTo(plaintext);
		assertThat(decrypted).isEqualTo(plaintext);
		assertThat(service.isEncryptionEnabled()).isFalse();
	}

	@Test
	void should_passthrough_when_key_is_null() {
		// given
		CredentialEncryptionService service = createService(null);

		// when / then
		assertThat(service.encrypt("password")).isEqualTo("password");
		assertThat(service.decrypt("password")).isEqualTo("password");
		assertThat(service.isEncryptionEnabled()).isFalse();
	}

	@Test
	void should_handle_null_plaintext() throws Exception {
		// given
		String key = generateBase64Key();
		CredentialEncryptionService service = createService(key);

		// when / then
		assertThat(service.encrypt(null)).isNull();
		assertThat(service.decrypt(null)).isNull();
	}

	@Test
	void should_reject_invalid_key_length() {
		// given — 128-bit key (16 bytes) instead of 256-bit
		String shortKey = Base64.getEncoder().encodeToString(new byte[16]);

		// then
		assertThatThrownBy(() -> createService(shortKey)).isInstanceOf(IllegalArgumentException.class)
			.hasMessageContaining("256 bits");
	}

	@Test
	void should_report_encryption_enabled_when_key_set() throws Exception {
		// given
		String key = generateBase64Key();
		CredentialEncryptionService service = createService(key);

		// then
		assertThat(service.isEncryptionEnabled()).isTrue();
	}

	@Test
	void should_fail_to_decrypt_tampered_ciphertext() throws Exception {
		// given
		String key = generateBase64Key();
		CredentialEncryptionService service = createService(key);
		String encrypted = service.encrypt("my-secret");

		// tamper with the ciphertext
		byte[] bytes = Base64.getDecoder().decode(encrypted);
		bytes[bytes.length - 1] ^= 0xFF;
		String tampered = Base64.getEncoder().encodeToString(bytes);

		// then
		assertThatThrownBy(() -> service.decrypt(tampered)).isInstanceOf(CredentialEncryptionException.class)
			.hasMessageContaining("Failed to decrypt");
	}

	@Test
	void should_fail_on_startup_when_production_profile_and_no_key() {
		// given
		given(this.environment.getActiveProfiles()).willReturn(new String[] { "production" });

		// then
		assertThatThrownBy(() -> createService("")).isInstanceOf(IllegalStateException.class)
			.hasMessageContaining("production");
	}

	@Test
	void should_encrypt_various_plaintext_values() throws Exception {
		// given
		String key = generateBase64Key();
		CredentialEncryptionService service = createService(key);

		// when / then — roundtrip for various values
		for (String plaintext : new String[] { "", "a", "short", "a-longer-password-with-special-chars!@#$%^&*()" }) {
			String encrypted = service.encrypt(plaintext);
			assertThat(service.decrypt(encrypted)).isEqualTo(plaintext);
		}
	}

}
