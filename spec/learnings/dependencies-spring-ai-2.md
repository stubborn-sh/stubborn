# Spring AI 2.0.0-M2 — Key Findings

**Category:** Dependencies
**Last Updated:** 2026-03-01

## Related Files
- `proxy/pom.xml` (Spring AI OpenAI dependency; version managed in root `pom.xml`)
- `broker-mcp-server/pom.xml` (Spring AI MCP Server WebMVC)

## Findings

### 2026-02-27: Artifact renamed in Spring AI 2.0.0-M2

The Spring AI OpenAI starter artifact was renamed between M1 and M2:

- **Old (M1):** `spring-ai-openai-spring-boot-starter`
- **New (M2):** `spring-ai-starter-model-openai`

The BOM (`spring-ai-bom:2.0.0-M2`) only manages the new artifact name. Using the old name
results in: `'dependencies.dependency.version' for org.springframework.ai:spring-ai-openai-spring-boot-starter:jar is missing`

**Evidence:** Local Maven repo has `spring-ai-openai-spring-boot-starter` at M1 only,
`spring-ai-starter-model-openai` at both M1 and M2.

### 2026-03-01: MCP annotation package is NOT in Spring AI core

The MCP tool/resource/prompt annotations are **NOT** in `org.springframework.ai.mcp.annotation` (this package doesn't exist). They're in:

**Package:** `org.springaicommunity.mcp.annotation`
**JAR:** `org.springaicommunity:mcp-annotations:0.8.0`
**Brought in transitively** by `spring-ai-starter-mcp-server-webmvc`

Key annotations:
- `@McpTool(name, description)` + `@McpToolParam(description, required)` — for tool methods
- `@McpPrompt(name, description)` + `@McpArg(name, description, required)` — for prompt methods
- `@McpResource(uri, name, description)` — for resource methods

**Discovery method:** Decompiled `McpServerAnnotationScannerAutoConfiguration` to find the static initializer referencing `org/springaicommunity/mcp/annotation/McpTool`.

**Important:** Prompt parameters use `@McpArg`, NOT `@McpToolParam`. Tool parameters use `@McpToolParam`.

### 2026-03-01: MCP Server STATELESS protocol works well for WireMock stubs

STATELESS mode (`spring.ai.mcp.server.protocol=STATELESS`) makes all MCP interactions standard HTTP POST/JSON-RPC, which is fully compatible with WireMock stubs and SCC contract testing. No session or SSE needed.

Config:
```yaml
spring:
  ai:
    mcp:
      server:
        name: stubborn
        version: 0.1.0
        type: SYNC
        protocol: STATELESS
```

## Change Log

| Date | Change |
|------|--------|
| 2026-02-27 | Initial discovery during Feature 7 implementation |
| 2026-02-27 | Updated file path for multi-module restructure (proxy/ module) |
| 2026-03-01 | Added MCP annotation package discovery and STATELESS protocol finding |
