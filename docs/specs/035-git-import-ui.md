# Spec 035 — Git Import UI

## What

A browser-based UI for importing contract files from Git repositories: triggering one-shot imports, managing registered Git import sources, and viewing resolved versions.

## Why

The Git import API (spec 029) is powerful but requires curl/CLI knowledge. A visual interface lets teams paste a repository URL, pick a branch and contracts directory, and import contracts with a single click. It also provides a management view for recurring Git sync sources.

## How

- **Import page** — Form for `POST /api/v1/import/git` with fields for application name, repository URL, branch, contracts directory, version override, and auth type (NONE / HTTPS_TOKEN / HTTPS_BASIC). Shows published/skipped/total and resolved version on completion.
- **Sources management** — CRUD table backed by `/api/v1/import/git-sources`. Toggle sync on/off per source. Pagination via Spring Data `Pageable`.
- **Auth handling** — Token and basic-auth credential fields; values are sent over HTTPS and never stored in the browser.
- **Validation** — Client-side validation mirrors backend constraints (required fields, URL format, no `file://` scheme).
- Reuses the existing Thymeleaf + HTMX patterns from the core broker UI (spec 020).
