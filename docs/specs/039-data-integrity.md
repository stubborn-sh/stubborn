# Spec 039 — Data Integrity and Security Hardening

## Problem

Several data integrity and security vulnerabilities exist in the broker:

1. **Race condition in contract publish** — The `existsBy...()` + `save()` sequence is not atomic. Two concurrent requests can both pass the existence check and attempt to save, resulting in a 500 Internal Server Error from the database unique constraint instead of the expected 409 Conflict.
2. **ZIP bomb in Maven import** — `MavenJarDownloader.extractContracts()` reads entries without tracking total extracted size, allowing a crafted archive with many small compressed entries to consume unbounded memory.
3. **Symlink escape in Git import** — `GitRepoCloner.extractContracts()` follows symbolic links during file tree walk, allowing a malicious repository to exfiltrate files outside the clone directory.
4. **SSRF via internal network URLs** — Both `MavenJarDownloader` and `GitRepoCloner` only validate the URL scheme (http/https) but do not block requests to internal/private network addresses.

## Solution

### 1. Race condition fix

Wrap `contractRepository.save()` in a try/catch for `DataIntegrityViolationException` and convert it to `ContractAlreadyExistsException` (mapped to 409 by `GlobalExceptionHandler`).

### 2. ZIP bomb detection

Add `MAX_EXTRACTED_SIZE` (500 MB) constant and a running total in `extractContracts()`. Throw `MavenImportException` if total exceeds the limit.

### 3. Symlink escape prevention

Add `Files.isSymbolicLink(file)` check in `extractContracts()` file visitor. Skip symlinks with a warning log.

### 4. SSRF hostname blocklist

Create `sh.stubborn.oss.security.UrlValidator` with `validateExternalUrl(String url)` that blocks:
- `127.0.0.0/8` (loopback)
- `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (private)
- `169.254.0.0/16` (link-local)
- `::1` (IPv6 loopback)
- `localhost`

Integrate into `MavenJarDownloader.validateUrl()` and `GitRepoCloner.validateUrl()`.

## Acceptance Criteria

- [ ] **AC-1**: When two concurrent publish requests arrive for the same contract key, one succeeds (201) and the other receives 409 Conflict (not 500).
- [ ] **AC-2**: A ZIP archive whose entries total more than 500 MB uncompressed causes `MavenImportException` with message containing "exceeded maximum size".
- [ ] **AC-3**: Symbolic links in a cloned Git repository are skipped during contract extraction.
- [ ] **AC-4**: URLs resolving to `127.0.0.1`, `10.x.x.x`, `172.16.x.x`, `192.168.x.x`, `169.254.x.x`, `::1`, or `localhost` are rejected with `IllegalArgumentException`.
- [ ] **AC-5**: External URLs (e.g., `https://github.com`) pass validation.

## Cross-references

- `@see ContractService#publish` — AC-1
- `@see MavenJarDownloader#extractContracts` — AC-2
- `@see GitRepoCloner#extractContracts` — AC-3
- `@see UrlValidator#validateExternalUrl` — AC-4, AC-5
