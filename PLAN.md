# Sales Assistant — Delivery Plan

**Status:** Proposed delivery sequence; no dates assigned.  
**Release target:** v2, first production release  
**Source of product scope:** [`PRD.md`](PRD.md)  
**Architecture proposal:** [`ARCHITECTURE.md`](ARCHITECTURE.md)  
**Last updated:** 2026-11-13

## Objective

Deliver a production-ready Sales Assistant installation for one Nigerian fashion retailer or boutique at a time. Each installation belongs to one business and has its own app deployment, database, AI resources, credentials, and customer data. Reuse the source code to set up another business as a separate installation. Charge a monthly fee per business installation. The release supports official WhatsApp and Instagram connections, grounded English and Nigerian Pidgin replies, seller-approved order preparation, verified Paystack payment collection/confirmation, and a seller dashboard. Validate the exact Meta seller-reply workflow, Paystack settlement model, repeatable per-business setup, and operating cost before launch.

## Build progress — 2026-11-13

- The Next.js dashboard shell is in place for a single-business installation.
- The initial Neon schema is represented in Drizzle ORM, and Drizzle Kit's baseline is initialized against the configured local Neon database. The historical SQL bootstrap migrations remain available for databases created before the Drizzle baseline.
- The Meta webhook route supports verification challenges, raw-body signature validation, account-ID filtering, idempotent message/status intake, and delayed-reply outbox records.
- The owner confirmed a WhatsApp test message reached their phone. The inbound webhook callback and native-app seller-reply detection have not yet been verified end to end.
- No worker consumes the outbox yet. The assistant remains paused; Phase 0 channel/account gates are still open.

## Delivery principles

- Build around seller control, deployment isolation, and auditable decisions from the start.
- Choose unresolved vendors and versions through documented decisions before implementation depends on them.
- Prove Meta channel eligibility/reply echoes and Paystack settlement early; do not build the entire product on an unverified integration assumption.
- Implement durable asynchronous workflows and idempotency before enabling real customer messaging or payments.
- Deploy, migrate, monitor, back up, and recover each business installation independently; never connect one business system to another.
- Ship in deployable increments with staging, observability, migrations, backups, and rollback considered throughout.

## Phase 0 — Resolve launch gates and architecture decisions

### Work

- Validate official Meta app setup, review/access requirements, eligible WhatsApp and Instagram account types, webhooks, seller replies sent outside Sales Assistant, send windows, and account onboarding with representative test accounts.
- Run a technical proof of concept for the exact seller workflow on both channels. Record payloads, whether a native-app seller reply is surfaced, supported account configurations, and limitations.
- Validate Paystack platform onboarding and subaccount settlement: platform eligibility, seller consent/identity requirements, recipient setup, fees, payment event verification, reversals/refunds, and reconciliation.
- Confirm the customer payment sequence: seller approves order -> payment checkout link is sent if connected and requested -> verified success -> confirmation. Confirm manual-payment fallback.
- Define technical decisions: supported Next.js/Node versions, auth provider, worker/queue/scheduler, hosting and region, object storage, AI and embedding providers, vector storage, email, monitoring, and subscription billing.
- Design the repeatable setup package for a complete business installation: app, dedicated Neon database, AI project/runtime, private storage, worker/queue, credentials, migrations, and health checks.
- Validate separate-installation operations, update/migration/backup procedures, setup time, Neon project/database costs, AI resource quotas, and monthly cost per business.
- Set numerical launch targets: availability, dashboard latency, webhook acknowledgement, reply latency, answer-quality evaluation, cost guardrails, load headroom, and retention defaults.
- Define the role-permission matrix, supported message/media types, catalog import format, and stale-stock policy.
- Produce threat model, privacy/data-flow map, provider cost model, and architecture decision records (ADRs).

### Exit gate

No unresolved question prevents proving native seller-reply detection on both channels, compliant Paystack seller settlement, or practical/costed setup of a complete single-business installation. Otherwise, reduce or change the design only with an explicit product decision and update the PRD and architecture before build.

## Phase 1 — Foundation for one business installation

### Work

- Create the Next.js application and worker deployment skeleton using selected supported versions and tooling.
- Configure local, CI/test, staging, and production environments with isolated credentials and data.
- Configure one deployment for one business, including that business’s dedicated Neon database, isolated AI resources, private storage, worker/queue, and per-installation secrets.
- Implement repeatable setup and migration steps so the same source can create a new, independent installation for another business.
- Implement authentication, email verification/reset, staff roles, invitation lifecycle, and authorization within the business installation.
- Ensure application configuration and repositories can access only this installation’s resources; no tenant selector or cross-business router is present.
- Define backup/PITR, restore, update, support, suspension, and offboarding procedures for each independently deployed instance.
- Add audit-event model, structured logs, correlation IDs, error reporting, secrets management, rate limits, and baseline security headers/session protections.
- Create the CI pipeline and deployment/migration conventions.

### Exit gate

- Auth and workspace permissions work for all four roles.
- Automated tests prove staff cannot access business resources without the right role and no business-specific resource is selected from browser input.
- Set up two isolated test deployments from the same source and demonstrate that databases, AI credentials, knowledge, files, and provider configuration remain separate.
- Staging deploy, business-database migration, backup creation, and restore drill are documented and repeatable.

## Phase 2 — Catalog, policies, and knowledge ingestion

### Work

- Implement product and seller-configurable variant management, prices, currency, stock, descriptions, and freshness metadata.
- Build CSV/spreadsheet import preview, schema mapping, validation errors, duplicate handling, and safe re-import.
- Add business information, FAQs, delivery/return policies, business hours, and approved payment instructions.
- Implement private document storage, malware/type/size checks, text extraction, chunking, embeddings, and processing status.
- Build private retrieval indexes/stores within each business’s database/AI resource boundary for policy/description passages and typed database queries for exact facts.
- Add source provenance and the seller-facing catalog/knowledge management screens.

### Exit gate

- Import failures do not corrupt existing valid data.
- Retrieval tests prove the installation only returns sources configured for its business and no source from another installation.
- Price and stock questions use structured data only; stale/unknown facts abstain.
- Sellers can inspect the source records supporting an answer.

## Phase 3 — Channel integrations and durable messaging pipeline

### Work

- Implement Meta onboarding and account eligibility states for WhatsApp and Instagram based on Phase 0 findings.
- Add webhook verification, normalized provider event models, durable event intake, dedupe keys, and replay tooling.
- Implement customer profiles, conversations, messages, channel timelines, send/delivery states, and audit trails.
- Add transactional outbox and durable job scheduler/worker; implement timer generation/versioning and cancellation.
- Implement seller messages from dashboard and supported connected-channel origins; enforce cancellation and takeover semantics.
- Add provider health/permission indicators and a safe disabled state when seller-reply detection is unavailable.
- Configure each webhook/job endpoint with only this installation’s credentials and resources; verify the second business installation has distinct endpoints, credentials, and AI project references.
- Implement outbound retries that reconcile provider status and avoid duplicate sends.

### Exit gate

- Replayed/duplicated webhooks do not duplicate conversation messages.
- Latest customer message resets the 60-second timer; seller message or takeover cancels it.
- Race-condition tests prove the worker does not send after a seller has replied or taken over.
- Full channel test exercises inbound and outbound conversation on both channels, including a seller reply sent from the native app.

## Phase 4 — Grounded agent and escalation

### Work

- Implement bounded intent handling and server-side exact-fact tools.
- Implement business-installation-scoped RAG for FAQ, policy, and descriptive product information.
- Select and integrate an AI provider behind an adapter; evaluate English and Nigerian Pidgin responses and provider data-handling terms.
- Configure this installation’s isolated AI project/runtime, credentials, knowledge index, and limits; a second business setup uses separate AI resources.
- Implement confidence threshold, grounded-claim validation, abstention, fallback response, conversation summary, and source attribution.
- Add agent permission checks and prompt-injection defenses for customer messages and uploaded knowledge.
- Add seller configuration for delay, threshold, allowed actions, fallback, and escalation contacts.

### Exit gate

- Evaluation set covers common product, variant, stock, price, delivery, returns, and business-hours questions in English and Pidgin.
- Unsupported, conflicting, stale, and adversarial test cases abstain or escalate; data fixtures are limited to this installation.
- Every agent reply shown in dashboard includes the source evidence and confidence/policy outcome needed for review.
- Provider timeout/outage never results in invented or duplicate messaging.

## Phase 5 — Order workflow and Paystack collection

### Work

- Implement order-detail collection and validation, including missing-field follow-up.
- Add order drafts, editable review screen, approve/reject decisions, role policy, immutable item/price snapshots, and activity log.
- Implement seller payment onboarding based on the validated Paystack subaccount model.
- Add server-side payment initialization, unique references, signed webhook verification, event deduplication, reconciliation, and payment status state machine.
- Add customer payment instructions/link after seller approval and only when customer selected online payment and setup is ready.
- Send confirmation only after a verified successful payment event; support seller-managed manual payment without claiming automatic verification.
- Add alerts for pending orders, mismatched payments, failed callbacks, and provider disconnection.

### Exit gate

- Unit/integration tests cover order transitions and authorization.
- Payment tests cover amount/currency/reference mismatch, invalid signature, duplicate event, delayed/reordered event, timeout, and success.
- A customer statement or screenshot cannot mark an order paid.
- Staging end-to-end order is initiated, verified, audited, and confirmed without processing real funds.

## Phase 6 — Seller dashboard, alerts, and subscription

### Work

- Complete dashboard navigation and screens for conversations, orders, catalog/knowledge, channel setup, team, settings, activity, and performance metrics.
- Implement takeover, per-conversation pause/resume, business-wide pause, and clear automation status.
- Add dashboard and email alerts with retry and delivery visibility.
- Implement flat monthly subscription per business, selected billing provider, resource entitlements/cost attribution, failed-payment/grace behavior, cancellation, and invoice/history UX once product decisions are set.
- Define business resource lifecycle for activation, past-due/suspension, cancellation, export, retention, and deletion. Never delete a business database or AI resources until approved retention/deletion rules permit it.
- Add export/delete requests and configurable retention controls, including legal/audit exceptions.
- Complete keyboard, screen reader, forms, contrast, and responsive behavior review.

### Exit gate

- Representative seller role journeys are complete without hidden privileged controls.
- Dashboard metrics reconcile to underlying events and do not leak sensitive payment details.
- Accessibility review issues are resolved to the selected target.
- Subscription failure/cancel states are clear and do not unexpectedly disable data export or block access to financial/audit records.

## Phase 7 — Production hardening and launch

### Work

- Complete unit, integration, end-to-end, security, load, and accessibility suites, including provisioning and cross-business isolation tests.
- Perform threat-model review and security assessment; remediate launch-blocking findings.
- Run burst/load tests using expected traffic plus agreed headroom; validate per-business and fleet queue/database/AI cost behavior, resource limits, and subscription margin assumptions.
- Validate database restore, object-storage recovery, key rotation, provider outage handling, webhook replay, dead-letter review, and rollback.
- Establish dashboards and alerts for reliability, latency, provider errors, queue lag, payment integrity, security events, and cost.
- Complete privacy/legal review, terms/privacy notice, data-processing disclosures, incident contacts, and support/runbooks.
- Pilot with the initial three businesses, validate channel-reply detection in real approved account setups, and review answer quality and payment reconciliation.
- Perform production readiness review and explicit go/no-go against numeric targets.

### Exit gate

All product and NFR acceptance criteria in [`PRD.md`](PRD.md) pass; Meta reply-detection and Paystack settlement gates are demonstrated; per-business provisioning, isolation, migration, backup/restore, and cost gates pass; rollback and restore procedures have been rehearsed; no unresolved critical security/integrity issue remains; and accountable owners approve release.

## Cross-cutting test strategy

- **Unit:** domain transitions, order/payment calculations, validation, timer generation, confidence/abstention policy, authorization policy.
- **Integration:** this installation’s repositories and role checks, transaction/outbox behavior, queue retries, Meta/Paystack adapters against fixtures/sandbox, webhook signature handling, document retrieval.
- **End-to-end:** sign-up/onboarding, connect channel, import catalog, receive customer message, timer, grounded response/escalation, seller takeover, draft order, approval, checkout, verified payment, confirmation, exports/deletion.
- **Security:** role escalation, cross-install credential/resource misconfiguration, session/CSRF, webhook spoof/replay, prompt injection, malicious upload, rate limits, secrets exposure, dependency scanning, and payment tampering.
- **Load/reliability:** message bursts, duplicate/out-of-order webhook delivery, worker restarts, queue backlog, provider throttling/outages, database connection limits, payment event retries.
- **Accessibility:** automated checks plus keyboard and screen-reader review of key dashboard journeys.
- **Operational:** backup restore, migration rollback/forward recovery, secret rotation, alert delivery, incident response, and dead-letter replay.

## Delivery dependencies and critical path

```text
Meta seller-reply proof ─┐
Paystack settlement proof ├─> Architecture decisions ─> Control plane + provisioning
Per-business infra proof ┤                             ├─> Business DB/AI isolation
Scope/quality targets ───┘                             ├─> Catalog + knowledge
                                                      ├─> Messaging pipeline ─> Agent
                                                      └─> Orders + payments
                                                                   └─> Dashboard/ops
                                                                        └─> Hardening/pilot/release
```

Meta reply detection, Paystack settlement, and per-business provisioning/cost are early critical-path proofs. Infrastructure selection, AI isolation/cost evaluation, privacy review, and measurable quality targets should be resolved before production hardening rather than deferred to the final release week.

## Completion criteria

The project is complete when the v2 scope is deployed to production, verified with the initial businesses, all defined quality gates pass, operators can monitor and recover integrations, the product owner accepts the feature set, and the team has a tested rollback and restore path.
