# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.1] - 2026-03-31

### Added

**Core Broker**
- Contract governance — publish, version, and track Spring Cloud Contract stubs
- Branch-aware versioning — contracts are scoped to application version and branch
- Dependency graph — visualize producer/consumer relationships across the system
- Webhook notifications — trigger CI pipelines on contract publication or verification
- Can-I-Deploy checks — verify a version is safe to deploy to a given environment
- Environments and deployments — track which version of each service is in each environment

**Import**
- Git import — pull contracts directly from a Git repository
- Maven import — pull stubs from a Maven repository

**API and UI**
- REST API — full HTTP API for all broker operations
- React UI — dashboard, dependency graph, can-i-deploy, contracts, verifications, webhooks, tags, environments

**Infrastructure**
- Helm chart — deploy to Kubernetes with a single `helm install`

**SDK and Tooling**
- JS SDK — TypeScript packages for cross-language contract testing (`@stubborn-sh/*`)
- Maven plugin — publish contracts and download stubs during Maven builds
- Gradle plugin — publish contracts and download stubs during Gradle builds

**Pro Features**
- CLI — command-line interface for broker interactions
- MCP server — Model Context Protocol server for AI assistant integration
- AI proxy — AI-assisted contract generation and analysis
