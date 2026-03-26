# Feature 7: AI Traffic-to-Contract Proxy

## What

An HTTP proxy that captures live traffic between consumer and producer, then uses an LLM
to generate Spring Cloud Contract YAML definitions from the captured request/response pairs.

## Why

Writing contracts manually is tedious and error-prone. By observing real traffic and
auto-generating contracts, teams can bootstrap their contract suite from existing integrations.

## How (High Level)

1. Consumer sends request through the broker proxy
2. Proxy forwards to the real producer and captures the request/response pair
3. Sensitive headers are redacted (Authorization, Cookie, API keys)
4. The captured traffic is sent to an LLM (via Spring AI ChatClient) with a prompt
   asking it to generate a Spring Cloud Contract YAML definition
5. The LLM response is parsed and validated
6. If valid, the contract is stored in the broker
7. The original response is returned to the consumer transparently

## Business Rules

- Sensitive headers (Authorization, Cookie, Set-Cookie, X-API-Key) must be redacted
  before sending to LLM
- LLM calls have retry with exponential backoff (max 3 attempts)
- Circuit breaker protects against LLM API failures
- Generated contracts use SCC dynamic matchers where appropriate (UUIDs, timestamps, emails)
- Proxy is transparent — consumer receives the original response regardless of contract generation

## Error Cases

- LLM API unavailable → circuit breaker opens, traffic still proxied, no contract generated
- LLM returns invalid YAML → logged as warning, no contract stored
- Max retries exceeded → contract marked as "unresolved"
- Target producer unreachable → 502 Bad Gateway returned to consumer
