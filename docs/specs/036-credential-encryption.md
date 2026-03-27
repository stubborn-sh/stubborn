# Spec 036 — Credential Encryption at Rest

## Problem

Maven import sources, Git import sources, and webhook headers store credentials as plaintext in PostgreSQL. Webhook headers often contain `Authorization: Bearer <token>` or `X-API-Key: <key>`.

## Solution

Introduce `CredentialEncryptionService` using AES-256-GCM to encrypt credentials before persisting and decrypt them when reading.

## Design

### `CredentialEncryptionService`

- Located in `sh.stubborn.oss.security`
- Uses `AES/GCM/NoPadding` with a random 12-byte IV per encryption
- Output format: `Base64(IV || ciphertext || GCM-tag)`
- Encryption key configured via `broker.credentials.encryption-key` (Base64-encoded 256-bit key)
- When the key is empty or absent, operates in **passthrough mode** (no encryption) for backward compatibility and development

### Integration points

| Service | Method | Action |
|---------|--------|--------|
| `MavenImportService` | `registerSource()` | Encrypt password before storing |
| `GitImportService` | `registerSource()` | Encrypt token before storing |
| `WebhookService` | `create()` / `update()` | Encrypt headers JSON before storing |
| `WebhookDispatcher` | `deliverWithRetry()` | Decrypt headers before HTTP dispatch |
| `WebhookResponse` | `from()` (3-arg) | Decrypt headers before returning to API |

When a future sync scheduler reads credentials from stored sources, it must call `decrypt()` before using them for authentication.

### Configuration

```yaml
broker:
  credentials:
    encryption-key: '' # Base64-encoded AES-256 key. Empty = no encryption (dev mode)
```

Generate a key: `openssl rand -base64 32`

## Acceptance criteria

- [ ] Encrypt/decrypt roundtrip produces original plaintext
- [ ] Same plaintext produces different ciphertexts (random IV)
- [ ] Empty key = passthrough (no encryption, backward compatible)
- [ ] Invalid key length is rejected at startup
- [ ] Tampered ciphertext causes decryption failure
- [ ] `MavenImportService.registerSource()` encrypts password
- [ ] `GitImportService.registerSource()` encrypts token
- [ ] `WebhookService.create()` encrypts headers
- [ ] `WebhookService.update()` encrypts headers
- [ ] `WebhookDispatcher` decrypts headers before HTTP dispatch
- [ ] `WebhookResponse` decrypts headers in API response
