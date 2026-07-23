---
layout: home

hero:
  name: Stubborn
  text: Contract Governance for Any Stack
  tagline: Register apps, publish contracts, record verifications, gate deployments. Works with JVM, Node.js, and any HTTP service.
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started
    - theme: alt
      text: Can I Deploy?
      link: /features/can-i-deploy

features:
  - title: Deployment Safety Gate
    details: '"Can I Deploy" answers whether it is safe to deploy version X to environment E, based on verified contracts across all running services.'
    link: /features/can-i-deploy
    linkText: Learn more
  - title: Language Agnostic
    details: Full support for JVM (Maven/Gradle plugins) and Node.js (@stubborn-sh/* npm packages). Any HTTP service works via the REST API.
    link: /features/contract-publishing-plugins
    linkText: Publishing plugins
  - title: MCP Server (PRO)
    details: 20+ MCP tools let AI coding agents query contracts, check compatibility, and interrogate the dependency graph. Available in Stubborn Pro.
    link: /features/mcp-server
    linkText: MCP Server docs
---

## What is Stubborn Broker?

Stubborn Broker is a central governance server for consumer-driven contract (CDC) testing. It stores contracts, tracks which versions have been tested against which, and answers the critical deployment safety question: **Can I Deploy?**

| Term | Meaning |
|------|---------|
| **Application** | A named service registered in the broker (consumer or producer) |
| **Contract** | A file describing the expected interaction between two services |
| **Verification** | A recorded test result: did the producer pass the consumer's contract? |
| **Deployment** | A record of which version is deployed in which environment |
| **Can I Deploy** | Safety gate: are all consumers in the target environment compatible? |

## How It Works

1. Consumer team **publishes a contract** describing what they expect from the producer
2. Producer team downloads the contract, runs the verifier, and **records the result**
3. Before deploying, the pipeline asks **Can I Deploy?** — the broker checks that every consumer currently deployed in the target environment has a passing verification
4. The broker returns ✅ safe or ❌ blocked with a list of failing consumers

## Quick Start

```bash
# Start the broker (requires Docker)
docker run -p 8080:8080 mgrzejszczak/stubborn:latest

# Open the UI
open http://localhost:8080
```

See the [Getting Started guide](./getting-started) for a complete walkthrough.
