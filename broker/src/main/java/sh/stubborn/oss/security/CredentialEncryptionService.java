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

import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;

/**
 * Provides AES-256-GCM encryption and decryption for stored credentials (Maven passwords,
 * Git tokens). When no encryption key is configured, operates in passthrough mode for
 * backward compatibility.
 */
@Service
public class CredentialEncryptionService {

	private static final Logger logger = LoggerFactory.getLogger(CredentialEncryptionService.class);

	private static final String ALGORITHM = "AES/GCM/NoPadding";

	private static final int GCM_IV_LENGTH = 12;

	private static final int GCM_TAG_LENGTH_BITS = 128;

	private final @Nullable SecretKey secretKey;

	private final boolean encryptionEnabled;

	private final SecureRandom secureRandom = new SecureRandom();

	public CredentialEncryptionService(@Value("${broker.credentials.encryption-key:}") @Nullable String base64Key,
			Environment environment) {
		if (base64Key == null || base64Key.isBlank()) {
			for (String profile : environment.getActiveProfiles()) {
				if ("production".equals(profile)) {
					throw new IllegalStateException(
							"broker.credentials.encryption-key must be set in the 'production' profile. "
									+ "Generate one with: openssl rand -base64 32");
				}
			}
			this.secretKey = null;
			this.encryptionEnabled = false;
			logger.warn("Credential encryption is DISABLED — credentials will be stored as plaintext. "
					+ "Set broker.credentials.encryption-key to enable encryption.");
		}
		else {
			byte[] keyBytes = Base64.getDecoder().decode(base64Key);
			if (keyBytes.length != 32) {
				throw new IllegalArgumentException(
						"Encryption key must be 256 bits (32 bytes) when Base64-decoded, got " + keyBytes.length
								+ " bytes");
			}
			this.secretKey = new SecretKeySpec(keyBytes, "AES");
			this.encryptionEnabled = true;
			logger.info("Credential encryption is ENABLED");
		}
	}

	/**
	 * Encrypts a plaintext credential. Returns Base64-encoded (IV + ciphertext + GCM
	 * tag). If encryption is disabled, returns the plaintext as-is.
	 * @param plaintext the credential to encrypt (may be null)
	 * @return the encrypted credential, or the plaintext if encryption is disabled
	 */
	public @Nullable String encrypt(@Nullable String plaintext) {
		if (plaintext == null) {
			return null;
		}
		if (!this.encryptionEnabled) {
			return plaintext;
		}
		try {
			byte[] iv = new byte[GCM_IV_LENGTH];
			this.secureRandom.nextBytes(iv);

			Cipher cipher = Cipher.getInstance(ALGORITHM);
			cipher.init(Cipher.ENCRYPT_MODE, this.secretKey, new GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv));

			byte[] ciphertext = cipher.doFinal(plaintext.getBytes(java.nio.charset.StandardCharsets.UTF_8));

			// Concatenate IV + ciphertext (which includes the GCM tag)
			byte[] combined = new byte[iv.length + ciphertext.length];
			System.arraycopy(iv, 0, combined, 0, iv.length);
			System.arraycopy(ciphertext, 0, combined, iv.length, ciphertext.length);

			return Base64.getEncoder().encodeToString(combined);
		}
		catch (GeneralSecurityException ex) {
			throw new CredentialEncryptionException("Failed to encrypt credential", ex);
		}
	}

	/**
	 * Decrypts an encrypted credential. Expects Base64-encoded (IV + ciphertext + GCM
	 * tag). If encryption is disabled, returns the input as-is.
	 * @param encrypted the encrypted credential (may be null)
	 * @return the decrypted plaintext, or the input if encryption is disabled
	 */
	public @Nullable String decrypt(@Nullable String encrypted) {
		if (encrypted == null) {
			return null;
		}
		if (!this.encryptionEnabled) {
			return encrypted;
		}
		try {
			byte[] combined = Base64.getDecoder().decode(encrypted);

			if (combined.length < GCM_IV_LENGTH) {
				throw new CredentialEncryptionException("Encrypted data is too short");
			}

			byte[] iv = new byte[GCM_IV_LENGTH];
			System.arraycopy(combined, 0, iv, 0, GCM_IV_LENGTH);

			byte[] ciphertext = new byte[combined.length - GCM_IV_LENGTH];
			System.arraycopy(combined, GCM_IV_LENGTH, ciphertext, 0, ciphertext.length);

			Cipher cipher = Cipher.getInstance(ALGORITHM);
			cipher.init(Cipher.DECRYPT_MODE, this.secretKey, new GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv));

			byte[] plaintext = cipher.doFinal(ciphertext);
			return new String(plaintext, java.nio.charset.StandardCharsets.UTF_8);
		}
		catch (GeneralSecurityException ex) {
			throw new CredentialEncryptionException("Failed to decrypt credential", ex);
		}
	}

	/**
	 * Returns true if encryption is enabled (a key has been configured).
	 * @return true if encryption is enabled
	 */
	public boolean isEncryptionEnabled() {
		return this.encryptionEnabled;
	}

}
