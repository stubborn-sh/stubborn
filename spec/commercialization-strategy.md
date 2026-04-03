# Commercialization Strategy

> Debate between Senior Product Owner (SPO), Senior QA (SQA), and Chief Marketing Officer (CMO).
> Date: 2026-03-15

---

## Part 1: What's OSS vs Commercial

### OSS Core (Apache 2.0)

| Module/Feature | Rationale |
|---|---|
| Broker core (register, publish, verify, deploy, can-i-deploy on main branch, environments, graph) | Table-stakes contract broker |
| UI (basic dashboard) | Demo-ability, first impression |
| Maven plugin + Gradle plugin | On-ramps for Java teams |
| `broker-contract-publisher` library | Foundation for all plugins |
| `broker-stub-downloader` (`sccbroker://`) | Consumer-side must work freely |
| Stub Runner Boot | Local dev experience |
| Samples + docs | Adoption accelerators |
| Helm chart + Kustomize | Deployment should be free |
| Basic webhooks (CONTRACT_PUBLISHED + VERIFICATION_PUBLISHED) | CI/CD integration essential |
| JS broker-client + publisher packages | Query and publish from Node.js |

### Team Tier ($299-499/mo per cluster)

| Feature | Value Proposition |
|---|---|
| Branch-scoped can-i-deploy | Safe feature-branch deployments |
| Pending contracts | Consumer-driven workflow without blocking |
| Consumer version selectors | Smart verification targeting |
| Content hash deduplication | 30-50% faster verification pipelines |
| Version tags | Semantic version management |
| Compatibility matrix | System-wide health overview |
| Full webhooks (all 5 events + retry + history) | Complete CI/CD automation |
| Data cleanup / retention | Automated maintenance |
| CLI (all 13 commands) | DevOps automation |
| JS stub-server + verifier + jest | Cross-language testing |

### Enterprise Tier (custom pricing)

| Feature | Value Proposition |
|---|---|
| AI traffic-to-contract proxy | Auto-generate contracts from live traffic |
| MCP server | AI agent integration (Claude, Copilot) |
| Maven import | Zero-friction migration from JAR-based stubs |
| Full RBAC + audit log | Compliance and governance |
| HA deployment (multi-replica, HPA) | Production resilience |
| JS stubs-packager | Full cross-language JAR interop |
| Priority support + SLA | Enterprise-grade backing |
| SSO / OIDC integration | Enterprise identity |

---

## Part 2: Self-Service Sales Strategy

### Stack: Stripe Checkout + Ed25519 License Keys

1. Landing page with 3 pricing cards
2. "Buy Team" button → Stripe Checkout session → payment → webhook fires
3. Stripe webhook → generates a license key → emails it to buyer automatically
4. Buyer pastes license key into broker config: `broker.license.key=XXXXX`
5. Broker validates key on startup → activates Team/Enterprise features

**Implementation:**
- Stripe Checkout (hosted page, zero frontend work) + small serverless function (AWS Lambda or Cloudflare Worker) for webhook + email
- Total code: ~100 lines
- Enterprise: "Contact Us" button → Calendly link for 30-min call

### Deliverables Before Spring IO

| Item | Effort |
|---|---|
| Landing page with pricing | 1 weekend (~13 hours) |
| Stripe account + 2 products (Team monthly, Team annual) | 2 hours |
| License key generator Lambda | 1 evening |
| License validation in broker | 1 evening |
| Email template (SendGrid/Resend) | 1 hour |

---

## Part 3: Licensing — Self-Signed Keys (Not Cryptlex)

**Recommendation: Ed25519 self-signed license keys for now.**

- Zero cost, zero vendor dependency
- Works fully offline — no license server phone-home
- Implementation: Ed25519 key pair. Private key stays with you. Public key embedded in broker JAR
- License payload: `{"tier":"team","org":"Acme","validUntil":"2027-03-15","features":["branches","selectors","matrix"]}`
- Signed with Ed25519, verified on broker startup

**Note:** Cryptlex has a free tier (up to 10 activations). Can migrate to Cryptlex when floating licenses or usage analytics are needed (likely 20+ customers).

**Why not Cryptlex now:**
- Self-signed keys work offline (important for enterprise air-gapped environments)
- No additional vendor dependency
- License is a purchase receipt, not DRM — companies with compliance departments won't crack it

---

## Part 4: Spring IO Barcelona Strategy

### At the Conference (Awareness)
- Demo the full flow: register → publish → verify → can-i-deploy → dependency graph
- "Wow" moment: AI proxy auto-generates contracts from traffic capture
- QR code on every slide → landing page with email capture
- No hard sell: "It's open source, try it today"

### Post-Conference Funnel

```
Spring IO attendees
  → QR code → landing page
    → "docker run contractly" (try in 30 seconds)
      → GitHub star + email signup
        → 3-email drip sequence (days 1, 7, 14):
           1. "Here's how to set up your first contract" (tutorial)
           2. "Here's how branch-aware testing works" (Team feature teaser)
           3. "Here's how AI generates contracts" (Enterprise feature teaser)
          → Some % hit feature wall (branch governance)
            → Self-service Stripe checkout
```

### Must-Have for Spring IO

| Must-Have | Nice-to-Have |
|---|---|
| Landing page with pricing | 2-min demo video |
| `docker run` one-liner that works | Comparison page vs Pact Broker |
| Email capture (Buttondown free tier) | Blog post announcing the product |
| 3-email drip sequence | Testimonial from 1 beta tester |
| GitHub README with clear OSS vs paid | |
| License key validation in broker | |
| Cloud demo instance | |

---

## Part 5: Repository Split Strategy

### Target Structure

**OSS Repository** (`stubborn`, public):
- build-tools/bom, build-tools/build-parent
- broker, ui, broker-api-client
- broker-stub-downloader, broker-contract-publisher
- broker-maven-plugin, broker-gradle-plugin
- stub-runner, js (broker-client + publisher only)
- samples, e2e-tests, docs, spec, charts, k8s

**Enterprise Repository** (`stubborn-enterprise`, private):
- proxy (AI traffic-to-contract)
- broker-mcp-server (MCP server)
- broker-cli (full CLI)
- broker-pro (license validation + premium feature modules)
- ui-pro (premium UI overlay)
- js-pro (stub-server, verifier, jest, stubs-packager, cli)
- e2e-tests-pro

### How Shipping Works

One Docker image, feature-flag activated:
```dockerfile
# OSS image
FROM eclipse-temurin:25-jre
COPY broker.jar /app/broker.jar

# Pro image extends OSS
FROM ghcr.io/spring-cloud/stubborn:latest
COPY broker-pro.jar /app/libs/broker-pro.jar
```

OSS broker checks `@ConditionalOnClass(ProLicenseValidator.class)` — if not present, premium features disabled.

### Split Phases

| Phase | Action | Duration |
|---|---|---|
| 0 | Create BOM + build-parent artifacts | 3 days |
| 1 | Migrate all modules to build-parent | 2 days |
| 2 | Self-contain broker-api-client | 0.5 day |
| 3 | Verify each module builds standalone | 1 day |
| 4 | Create enterprise repo skeleton | 0.5 day |
| 5 | Move proxy, cli, mcp-server to enterprise | 1 day |
| 6 | Split JS workspaces | 1 day |
| 7 | Design broker extension SPI | 3-5 days |
| 8 | Set up enterprise CI/CD | 1 day |
| 9 | E2E test split | 1 day |
| **Total** | | **~14 days** |

---

## Part 6: Cloud Demo Instance

**Shared read-only demo on Railway/Fly.io ($5-10/mo):**
- Pre-loaded with realistic sample data (5 apps, 20 contracts, verifications, graph)
- Read-only for anonymous users (READER role)
- Login required to publish/modify (demo credentials on landing page)
- Nightly reset via cron job (drop + re-seed)
- Demo runs with a "demo" license key enabling all features + banner: "This is a demo instance"

---

## Part 7: Realistic Expectations

### This Is NOT a Startup

| Startup Mindset (avoid) | Side Project Mindset (adopt) |
|---|---|
| Raise money, hire, scale fast | Bootstrap, stay solo, grow slow |
| Need 1000 customers in year 1 | Need 5 paying customers in year 1 |
| Build everything before launch | Ship OSS now, add paid later |
| Failure = company dies | Failure = you still have 2 jobs and a popular OSS project |
| Optimize for revenue | Optimize for learning + reputation |

### Realistic 12-Month Timeline

| Month | Milestone | Revenue |
|---|---|---|
| 0 (Spring IO) | Launch OSS + landing page + demo | $0 |
| 1-3 | 100-300 GitHub stars, 10-20 email signups | $0 |
| 3-6 | First Team trial requests, iterate on pricing | $0-$500 |
| 6-9 | 2-5 Team subscriptions | $600-$2,500/mo |
| 9-12 | First Enterprise inquiry | $2,500-$5,000/mo |

**Time budget: 8 hours/week max.** If it takes off, invest more. If not, you have a great OSS project.

---

## Part 8: Action Plan Before Spring IO

| Priority | Task | Effort |
|---|---|---|
| P0 | Split repo (OSS public + Pro private) | 1 weekend |
| P0 | Ed25519 license validation in broker | 1 evening |
| P0 | `@ConditionalOnClass` activation for Pro features | 1 weekend |
| P0 | Landing page with 3 pricing cards + Stripe Checkout | 1 weekend (~13h) |
| P0 | `docker run` one-liner with sample data | 1 evening |
| P1 | Cloud demo instance (Railway/Fly.io) | 1 evening |
| P1 | 3-email drip (Buttondown) | 2 hours |
| P1 | Lambda for Stripe webhook → license key email | 1 evening |
| P2 | Comparison page vs Pact Broker | 2 hours |
| P2 | 2-min demo video | 1 evening |

---

## Part 9: Naming — "Contractly"

### Availability Research (2026-03-15)

| Asset | Status |
|---|---|
| contractly.dev | TAKEN (parked, no product) |
| contractly.io | TAKEN (active redirect) |
| contractly.com | TAKEN (unclear, possibly parked) |
| contractly.co | TAKEN (parked) |
| contractly.tech | TAKEN (active product — contract management app) |
| @contractly npm scope | AVAILABLE |
| github.com/contractly | EXISTS (empty/dormant org) |
| github.com/contractly-dev | AVAILABLE |
| USPTO trademark | No registered trademark found (needs verification) |

### Existing Products Named "Contractly"

1. **Contractly (contractly.tech)** — Contract and subscription management app
2. **Contractly AI (Product Hunt, Aug 2025)** — AI-powered contract analysis for legal
3. **Contractly (Infinisix Legum)** — AI dispute resolution for legal professionals
4. **Contractually (contractual.ly)** — Separate but confusingly similar

### Assessment

The name has collision risk in the contract management/legal-tech space. However:
- All existing products are in legal/business contract management, not developer tools
- The developer-tool market is completely different audience
- npm scope is available, GitHub org `contractly-dev` is available
- No formal trademark registered

### Alternative Names Considered

| Name | Vibe | Domains Checked? |
|---|---|---|
| Contractly | Clean, professional | All taken |
| Pactum | Latin for contract, nods to Pact | Not checked |
| Stubborn | Playful, "stubs" pun | Not checked |
| Vertico | Verify + contract | Not checked |
| Accorda | From accord, European flair | Not checked |
| Gatekeep | Describes the deployment gate | Not checked |
| Covenant | Binding agreement | Not checked |
| Signet | Seal of approval | Not checked |
| Arbitra | Arbiter between services | Not checked |
| Tessera | Mosaic tile, services fitting together | Not checked |

---

## Part 10: Landing Page Plan

### Tech Stack
- **Astro + Tailwind CSS 4** on **Cloudflare Pages** (free)
- 3 dependencies total: astro, @astrojs/tailwind, tailwindcss
- Dark mode only, Spring green accent (#6db33f)
- Inter + JetBrains Mono fonts

### Page Sections
1. **Hero** — headline, two CTAs (demo + pricing), terminal screenshot
2. **Problem** — 3 lines about why teams need this
3. **Features** — 4 cards (branch governance, AI proxy, MCP server, cross-language SDK)
4. **How It Works** — 3-step: Publish → Verify → Deploy
5. **Live Demo** — link to cloud demo instance
6. **Pricing** — 3-column (Community/Team/Enterprise)
7. **Social Proof** — "Built by a Spring Cloud Contract maintainer"
8. **Email Capture** — Buttondown form (free, 100 subscribers)
9. **Footer** — links to GitHub, docs, demo

### Stripe Integration
- Stripe Payment Links (URL, no code needed)
- "Buy Now" → `<a href="https://buy.stripe.com/xxx">`
- Post-payment redirect to `/thank-you` page

### Effort: ~13 hours (1 weekend + 1 evening)

---

## Part 11: Naming — DECISION: Stubborn

### Chosen Name: **Stubborn**

**Tagline:** "Your contracts should be stubborn — they don't break just because someone pushed on a Friday."

**Why Stubborn:**
- Double meaning: "stubs" (contract stubs) + "stubborn" (uncompromising contract compliance)
- Memorable, fun, great for conference swag and t-shirts
- Tells a story: "Stubborn about your API contracts"
- `stubborn.sh` is a perfect domain for a developer tool

**Brand Assets:**

| Asset | Value | Status |
|---|---|---|
| Domain | **stubborn.sh** | AVAILABLE |
| Domain (alt) | getstubborn.dev | AVAILABLE |
| Domain (alt) | usestubborn.dev | AVAILABLE |
| npm scope | **@stubborn-dev** | AVAILABLE |
| GitHub org | **getstubborn** | AVAILABLE |
| GitHub org (alt) | stubborn-io | AVAILABLE |
| Group ID | sh.stubborn | Existing |

**Known noise (not blockers):**
- `stubborn-ws` (npm) — HTTP mock server for tests, different product
- `stubborn-server` (npm) — stub server, different product
- `stubborn-io` (crates.io) — Rust TCP library, different ecosystem
- `@stubborn` npm scope claimed but empty
- `stubborn-dev` GitHub username claimed but dormant (0 repos)

### Rejected Names

| Name | Reason |
|---|---|
| Contractly | All domains taken, multiple legal-tech products with same name |
| Signet | Existing contract testing framework (signet-framework.dev), npm/GitHub taken |
| Tessera | gettessera.dev is active dev tool, ConsenSys Tessera is Java enterprise project |
| Vertico | Available but meaningless — "verify + contract" is a stretch nobody would guess |
| Accorda | Good but phonetically identical to Acorda Therapeutics (NASDAQ: ACOR) |

---

## Part 12: Licensing Decision — Cryptlex

**Decision: Use Cryptlex** (free tier, up to 10 activations).

Advantages over self-signed keys:
- Activation analytics from day one
- Hardware fingerprinting (prevents key sharing)
- License portal for customers (self-service activation/deactivation)
- Trial license generation
- Java SDK (LexActivator) available
- Free tier sufficient for first 10 customers

Implementation:
1. Create Cryptlex account, define 2 products (Team, Enterprise)
2. Integrate LexActivator Java SDK into `broker-pro` module
3. License check on broker startup — validates against Cryptlex servers (with offline grace period)
4. Stripe webhook → Cryptlex API to generate license key → email to customer

---

## Part 13: Monorepo Restructure Plan

### Target Folder Structure

```
stubborn/
├── pom.xml                          (thin reactor: lists build-tools, broker-oss, broker-enterprise, e2e-tests)
├── build-tools/
│   └── build-parent/pom.xml         (inherits spring-boot-starter-parent, all shared plugins/deps)
├── broker-oss/
│   ├── pom.xml                      (aggregator)
│   ├── stubborn-openapi-validator/   (separate repo: stubborn-sh/stubborn-openapi)
│   ├── ui/
│   ├── js/
│   ├── broker/
│   ├── broker-api-client/
│   ├── broker-stub-downloader/
│   ├── broker-contract-publisher/
│   ├── broker-maven-plugin/
│   ├── broker-gradle-plugin/
│   └── stub-runner/
├── broker-enterprise/
│   ├── pom.xml                      (aggregator)
│   ├── broker-pro/                  (NEW: license + SPI implementations)
│   ├── proxy/
│   ├── broker-cli/
│   └── broker-mcp-server/
├── e2e-tests/
├── samples/
├── docs/
├── spec/
├── charts/
├── k8s/
└── src/license-header.txt
```

### Key POM Changes

1. **Root POM** → thin reactor (no properties, no plugins, no dependencyManagement)
2. **build-tools/build-parent** → inherits spring-boot-starter-parent, carries ALL shared config
3. **broker-oss/pom.xml** → parent = build-parent, modules list
4. **broker-enterprise/pom.xml** → parent = build-parent, modules list
5. **Every leaf module** → parent = its group aggregator (broker-oss or broker-enterprise)
6. **e2e-tests, samples** → parent = build-parent with relativePath

### Broken Paths to Fix

| Module | Old Path | New Path |
|---|---|---|
| broker (AsciiDoc) | `${project.parent.basedir}/docs/...` | `${maven.multiModuleProjectDirectory}/docs/...` |
| broker-api-client (OpenAPI) | `${project.basedir}/../spec/...` | `${maven.multiModuleProjectDirectory}/spec/...` |
| dev.sh | `ui/`, `broker/` | `broker-oss/ui/`, `broker-oss/broker/` |
| CI `-pl` flags | `-pl broker` | `-pl broker-oss/broker` |

### Build Verification

Everything still builds with `./mvnw clean install -T 1C` from root.

---

## Part 14: Broker Extension SPI Design

### Architecture

Strategy interfaces in OSS broker + `@Primary` beans in Pro JAR via AutoConfiguration.

### Interfaces to Create

| Interface | Package | OSS Default | Pro Override |
|---|---|---|---|
| `DeploymentSafetyChecker` | safety/ | Ignores branch param | Branch-aware + content hash transitive |
| `VerificationMatcher` | verification/ | Direct version match only | Content hash transitive verification |
| `WebhookEventFilter` | webhook/ | 2 event types | All 5 event types |
| `BrokerLicenseChecker` | spi/ | Returns "oss" | Validates Cryptlex license |

### Pro-Only Feature Gating

These entire features are gated with `@ConditionalOnProperty("broker.pro.enabled")`:
- Tags (TagController, TagService)
- Selectors (SelectorController, SelectorService)
- Matrix (MatrixController, MatrixService)
- Cleanup (CleanupController, CleanupService)

Database migrations stay in OSS (tables exist but are unused without Pro).

### Pro JAR AutoConfiguration

```java
@AutoConfiguration
@ConditionalOnClass(name = "sh.stubborn.broker.BrokerApplication")
@ConditionalOnProperty(name = "broker.pro.license-key")
public class BrokerProAutoConfiguration {
    // @Primary @Bean for each strategy interface override
}
```

### Feature Discovery Endpoint

`GET /api/v1/broker/info` → `{ "edition": "oss", "features": [...] }`
UI queries this to show/hide Pro feature tabs.

### Refactoring Steps

1. Create SPI interfaces in broker module
2. Create OSS default implementations (extract from existing services)
3. Refactor services to delegate to strategy interfaces
4. Add `@ConditionalOnProperty` to Pro-only controllers
5. Add `/api/v1/broker/info` endpoint
6. Create `broker-pro` module with AutoConfiguration
