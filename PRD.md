# Sales Assistant — Product Requirements

**Status:** Draft for implementation planning  
**Product:** Sales Assistant  
**Release target:** v2, first production release  
**Initial market:** Nigeria  
**Last updated:** 2026-11-13

## 1. Product summary

Sales Assistant is a web application deployed for one medium or large Nigerian fashion retailer or boutique that takes online orders. Each deployed installation belongs to one business and connects to that business’s WhatsApp and Instagram messaging. It waits for a seller to answer, then responds to routine customer questions using that business’s approved catalog and knowledge. It can collect order details and prepare an order for seller approval. Sellers remain responsible for business commitments and payment verification. The source code is the reusable setup template for creating a separate installation for another business.

Each business installation has its own database and AI infrastructure. Sales Assistant charges a monthly fee per business installation for the service and its assigned resources. No installation shares business data, credentials, database, or AI context with another business. The core promise is to help a business respond promptly and prepare complete orders without allowing the AI to invent product facts, confirm unapproved orders, or claim that payment succeeded without verification.

## 2. Goals and success measures

### Goals

- Reduce time that customer messages wait unanswered.
- Provide accurate answers grounded in the correct business’s approved data.
- Escalate unsupported or uncertain questions to a seller.
- Capture order details consistently and leave approval with the seller.
- Confirm payment only from a verified Paystack event or an authorized seller action.
- Give sellers visibility and control over channel connections, automation, orders, and agent activity.
- Provision a distinct business database and isolated AI resource boundary for every business.

### Initial success measures

The dashboard should report at least:

- Median and percentile time to first response, split by seller and agent.
- Messages answered automatically and messages escalated.
- Orders drafted, approved, rejected, and paid.
- Agent replies with supporting source records.
- Integration and job failures requiring attention.

Numerical targets for response time, answer quality, conversion, availability, and cost are **not yet set** and must be agreed before launch.

## 3. Users and roles

Each deployment serves one business workspace. That business can connect multiple channels and invite multiple staff members. A deployment has no in-app workspace switching or access to another business; another business is served by a separate deployment created from the same source code.

| Role | Intended access |
| --- | --- |
| Owner/admin | Manage workspace, users, channels, agent settings, payment setup, data export/deletion, and order/payment decisions. |
| Support agent | View and reply to assigned or permitted conversations; take over a conversation. |
| Order approver | Review, edit, approve, or reject draft orders; verify payment when authorized. |
| Read-only viewer | View permitted conversations, orders, and activity without changing them. |

The precise permission matrix and whether support agents can approve orders must be finalized during design. Sensitive actions named by the product owner—channel connection, agent settings, payment verification, order approval, data export, and inviting/removing staff—require owner/admin access or explicit confirmation.

## 4. Release scope

### In scope for v2

- Responsive web dashboard for business onboarding and day-to-day seller operations.
- Official Meta API connections for WhatsApp Business Platform and eligible Instagram professional accounts.
- Full core-loop parity across both channels: receive messages, cancel or delay a response, answer or escalate, collect order details, create pending orders, and support payment links.
- Email/password sign-in, email verification, and password reset.
- One business workspace per installation, with staff invitations and role-based access.
- A repeatable setup/deployment process that gives each business installation its own database and isolated AI resources.
- Product catalog forms and CSV/spreadsheet import.
- Business information, FAQs, policies, and approved payment instructions.
- Exact-fact database retrieval and passage retrieval for descriptive/policy content.
- Configurable response delay, default 60 seconds; each newer customer message restarts the timer.
- One configurable auto-send confidence threshold per business. Below threshold, abstain and alert.
- Seller takeover and pause. A takeover pauses bot messages until a seller explicitly resumes. A seller reply through a connected channel cancels the pending response and the agent waits for a new customer message.
- Draft order collection and seller review, edit, approval, or rejection.
- Paystack payment collection using a seller subaccount with settlement directed to the seller, subject to provider validation.
- Confirmation to the customer only after verified payment success.
- Dashboard and email alerts; audit/activity history; basic performance metrics.
- Configurable data retention and business export/deletion controls.
- English and Nigerian Pidgin customer conversations and replies.

### Explicitly outside the agreed v2 scope

- Additional messaging channels beyond WhatsApp and Instagram.
- Automatic seller commitments, order approval, or payment confirmation by the AI.
- AI-generated price, stock, payment, or order-status facts from unstructured documents.
- Other vertical-specific catalog integrations; Sales Assistant’s catalog is the launch source of truth.

No other exclusions were specified. Rich media handling (images, audio, video, attachments) and detailed product image workflows remain undecided.

## 5. Primary journeys

### 5.1 Seller onboarding

1. Seller creates an account, verifies email, and creates a business workspace.
2. Sales Assistant setup provisions the business’s dedicated database and AI resources for that installation. The monthly fee is associated with the business installation; pricing and billing mechanics remain to be defined.
3. Owner/admin connects WhatsApp and/or Instagram through the official Meta connection flow.
4. The system checks the channel’s eligibility, required permissions, webhook subscription, and ability to observe seller replies.
5. Seller enters products and variants through forms or imports a CSV/spreadsheet; seller adds policies and FAQs.
6. Seller configures response delay, confidence threshold, fallback message, escalation contacts, and payment setup.
7. Seller completes a test conversation and receives a clear readiness state before enabling automation.

**Acceptance:** Automation cannot be enabled for a channel until required permissions and reply detection have been verified. Incomplete catalog or payment setup must disable only the dependent capability and explain why.

### 5.2 Delayed customer reply

1. A customer message arrives from a connected channel and is recorded idempotently.
2. A response timer is scheduled for the business-configured delay (60 seconds by default).
3. Each later customer message restarts the timer. A seller message or dashboard takeover cancels the pending response.
4. On expiry, the system determines intent and retrieves exact facts from structured records and relevant passages from the business’s knowledge base.
5. If evidence supports an answer and confidence meets the configured threshold, the agent sends a reply in the customer’s language and records the sources used.
6. If it cannot answer safely, it sends the configured fallback if permitted, creates an escalation, and alerts the seller.

**Acceptance:** A retry, duplicate webhook, or concurrent seller reply must not create duplicate customer messages. If seller reply detection is uncertain, the system must not auto-send.

### 5.3 Order preparation and payment

1. Customer expresses intent to order.
2. The agent collects item, variant, quantity, customer name and phone, delivery address/area, and payment method if the customer chooses to pay now.
3. Agent validates product/variant and current price/availability through structured catalog data; it asks follow-up questions for missing required details.
4. Agent creates a pending order and alerts authorized staff.
5. Seller reviews, edits, approves, or rejects the order. Approval is an explicit business decision.
6. **Assumption to confirm in implementation planning:** after approval, Sales Assistant sends an order summary and Paystack checkout link when Paystack is connected and customer chose to pay online. If no payment setup exists, it routes the seller to handle payment manually.
7. Paystack webhook is authenticated and matched to the intended order, amount, currency, and reference. Only then can the order become paid and Sales Assistant send a payment/order confirmation.

**Acceptance:** A customer statement, screenshot, redirect to a success page, or unmatched webhook never marks an order paid. Payment events are idempotent and auditable. Any mismatch or ambiguous result is flagged for review.

### 5.4 Seller takeover

- A seller can take over one conversation or pause automation for a business.
- Conversation takeover silences the agent in that conversation until a seller explicitly resumes it.
- A detected seller reply on WhatsApp or Instagram cancels any pending response; a new customer message is required before a later agent response is considered.
- The conversation view provides message history, agent summary, order context, and evidence supporting previous agent replies.

## 6. Functional requirements

### Workspace, auth, and permissions

- **FR-01:** Users can register with email/password, verify email, sign in, reset passwords, and sign out.
- **FR-02:** A deployment is associated with one business workspace; staff membership and role are scoped to that business.
- **FR-03:** Server-side authorization is checked for every business resource and mutation. No user or API can select another business’s database or AI resources from this deployment.
- **FR-04:** Sensitive actions are audited with actor, workspace, action, target, timestamp, and outcome.

### Channels and conversations

- **FR-05:** Owners can connect, inspect, disable, and reconnect eligible WhatsApp and Instagram accounts.
- **FR-06:** Webhook events are authenticated where supported, durably recorded, deduplicated, and processed asynchronously.
- **FR-07:** Conversation timelines distinguish customer, seller, and agent messages, channel, delivery status, and source event.
- **FR-08:** Seller messages cancel queued agent responses. If channel-originated seller messages cannot be reliably detected, automation for that channel remains disabled.
- **FR-09:** Sellers can take over a conversation, pause/resume automation, and configure response delay and fallback copy.
- **FR-10:** Agent replies retain the structured records and knowledge passages that supported the answer.

### Catalog and knowledge

- **FR-11:** Businesses manage products, seller-defined variant dimensions/options, price, currency, stock, descriptions, and active status.
- **FR-12:** Businesses import catalog data via CSV/spreadsheet with preview, validation errors, and safe re-import behavior.
- **FR-13:** Businesses add policies, FAQs, delivery information, hours, and approved payment instructions.
- **FR-14:** Price, stock, order status, and payment status are read from structured records only.
- **FR-15:** Retrieval uses only the configured business’s catalog and knowledge in this deployment; no other business’s content can enter prompts or responses.
- **FR-16:** Stale or missing exact facts cause abstention and escalation. The staleness policy must be defined before launch.

### Agent and order management

- **FR-17:** Businesses configure one auto-send confidence threshold and allowed agent actions.
- **FR-18:** The agent asks for missing order fields, creates a pending draft, and never approves it.
- **FR-19:** Authorized staff can review, edit, approve, or reject orders and leave an audit trail.
- **FR-20:** The agent can summarize conversations for seller handoff.
- **FR-21:** Customer-facing order confirmation follows a verified payment event or authorized seller action, according to the configured payment path.

### Payments and billing

- **FR-22:** Paystack collection is enabled only for a business with a validated seller settlement setup.
- **FR-23:** Each checkout reference is unique and linked to one workspace, order, amount, and currency.
- **FR-24:** Paystack webhook signatures are verified against the raw request body; duplicate events are safe to process.
- **FR-25:** Sales Assistant charges a monthly fee per business installation covering its assigned service and resources. Price, any one-time setup charge, trial, payment method, grace period, resource limits, billing provider, and whether billing is integrated into the app or managed separately remain TBD.

### Alerts, metrics, and data controls

- **FR-26:** Dashboard and email alerts cover low-confidence/unsupported questions, unusual requests, failed integrations/jobs, and orders awaiting approval.
- **FR-27:** Dashboard reports response time, escalation volume, order drafts and decisions, payment outcomes, and agent activity.
- **FR-28:** Businesses can export and delete their data subject to retention, audit, and legal requirements defined before launch.
- **FR-29:** Owners can configure retention; the product communicates retention behavior clearly.

## 7. Non-functional requirements

- **Security:** Enforce staff role permissions and installation isolation, least privilege, secure session handling, secret management, webhook verification, rate limiting, input validation, and audit logs. Threat model authorization, prompt injection, malicious uploads, replayed webhooks, duplicate jobs, and credential compromise.
- **Deployment isolation:** One installation serves one business and has that business’s own database, AI resources, credentials, knowledge, and customer data. Other businesses use separate deployments made from the same source code. No cross-business connection or access is exposed in the product.
- **Privacy:** Minimize customer data, encrypt data in transit and at rest, restrict employee access, and define retention/deletion behavior. Complete a Nigeria-specific privacy/legal review before production.
- **Reliability:** Durable async work, bounded retries with backoff, dead-letter/manual replay path, idempotency, and observable job states. A failure must never silently turn into a business commitment.
- **Performance:** Targets TBD; define separately for dashboard requests, webhook acknowledgement, response scheduling, and AI completion.
- **Scale:** Initial sizing is three businesses and approximately 100 conversations per business per day. Load tests must cover burst traffic and webhook retries above expected average.
- **Accessibility:** Keyboard-operable dashboard, semantic structure, focus states, and accessible forms/alerts; select a WCAG target during design.
- **Localization:** English and Nigerian Pidgin at launch; keep currency and locale configurable, with NGN as the initial currency assumption.
- **Observability:** Structured logs, metrics, traces/correlation IDs, integration health, job lag/retry counts, payment reconciliation alerts, and privacy-safe audit records.

## 8. Open decisions and risks

- Verify Meta app review/access, WhatsApp seller-reply echo behavior, and Instagram native-app reply webhook behavior for the exact onboarding flow. This is a go-live blocker.
- Verify Paystack subaccount creation/verification and direct seller settlement model for a platform integration; confirm fees, supported currency, reversals/refunds, and reconciliation.
- Decide hosting and data region, AI provider/model, durable queue, object storage, auth service, and exact supported stable versions during architecture validation.
- Define whether each business installation is hosted by Sales Assistant or in a business-controlled account, and how setup, updates, migrations, backups, support, and offboarding work across separate deployments.
- Set AI resource isolation level, uptime/latency, answer quality, confidence calibration, stock staleness, retention defaults, resource limits, and cost guardrails that support the monthly fee.
- Define the exact role permission matrix, supported message/media types, unsupported intents, and subscription billing lifecycle.
- Validate relevant Nigerian privacy, consumer protection, payment, and messaging obligations with qualified counsel.

## 9. Definition of product readiness

V2 is ready to deploy only when the agreed scope is implemented and the following pass: unit, integration, and end-to-end test suites; security review and remediation of launch-blocking findings; load tests at agreed headroom; accessibility review; backup restore drill; monitoring and alert validation; rollback/release rehearsal; Meta channel onboarding and reply-detection pilot; Paystack payment verification and reconciliation tests; and documented operator runbooks. Numeric thresholds and go/no-go owners must be set before release.
