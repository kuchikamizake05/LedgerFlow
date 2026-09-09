# LedgerFlow Semester Learning Design

Date: 2026-08-08

## Objective

Build a production-minded, full-stack financial transaction simulator while rebuilding backend and infrastructure knowledge from first principles. The semester should produce three outcomes at once:

1. Deeper understanding of backend, database, Linux, containers, cloud, security, and reliability.
2. A portfolio project suitable for backend or platform internship applications.
3. Transferable components and experience for organizations, competitions, and Web3 hackathons.

The learning model is **one month to ship, followed by three months to deepen**. The first month delivers a complete vertical slice. The remaining months test, break, harden, operate, and extend the same system.

## Time Budget and Sustainability

- Normal workload: 15–20 focused technical hours per week.
- Target workload: approximately 18 hours per normal week.
- Peak workload: no more than 24 hours in an exceptional week.
- Organization and hackathon time replaces project hours rather than stacking on top of them.
- A busy-week floor of 8–10 hours preserves continuity.
- Every fourth week includes review, cleanup, documentation, and reduced cognitive load.
- Sleep and academic obligations are constraints, not expendable resources.

The roadmap is intentionally intensive but does not use burnout as a success criterion.

## Product Definition

LedgerFlow is a simulated digital wallet and double-entry ledger system. It resembles the transaction core behind a mobile banking product, but it does not process real money or integrate with banking networks.

### User experience

The responsive web application provides:

- Registration, login, and logout.
- Balance dashboard.
- Internal wallets/accounts.
- Transfer form and confirmation.
- Transaction history and details.
- Pending, successful, failed, and reversed states.
- Profile and security settings.

The administration interface provides:

- User and account lookup.
- Account freeze and unfreeze.
- Simulated deposits.
- High-value transaction approval.
- Transaction reversal.
- Audit-log inspection.
- Basic system-health visibility.

### Explicit exclusions

- Real money, payment gateways, or bank integrations.
- Identity-document or KYC storage.
- Native Android or iOS applications.
- Production use by third parties.
- Kubernetes or multi-cloud deployment during the core build.
- Premature decomposition into microservices.

## Technical Architecture

LedgerFlow starts as a modular monolith so domain correctness can be learned without distributed-system overhead.

### Primary stack

- Backend: Java and Spring Boot.
- Frontend: Next.js and TypeScript.
- Database: PostgreSQL with Flyway migrations.
- Cache and rate limiting: Redis.
- Asynchronous jobs: RabbitMQ, introduced after the transaction core is stable.
- Local runtime: Docker Compose.
- Edge and TLS: Caddy.
- CI/CD: GitHub Actions.
- Testing: JUnit 5, AssertJ, Testcontainers, Playwright, k6, and JaCoCo.
- Operations: structured logs, health endpoints, metrics, backup, and restore procedures.

### Backend modules

- `identity`: users, authentication, roles, and sessions/tokens.
- `accounts`: wallets, account status, and balance projection.
- `transfers`: transfer requests, limits, and lifecycle state.
- `ledger`: journals and immutable debit/credit entries.
- `approvals`: policies and manual approval workflow.
- `notifications`: asynchronous user notifications.
- `audit`: records of sensitive user and administrator actions.
- `reconciliation`: verification that account projections match ledger truth.

Modules live in one deployable application but communicate through explicit interfaces and domain events. Direct cross-module database manipulation is avoided.

## Transaction Correctness

A transfer follows this sequence:

1. The frontend submits the transfer with an idempotency key.
2. The backend authenticates the actor and validates the amount and destination.
3. The relevant accounts are locked in a deterministic order.
4. Balance, account status, limits, and approval requirements are checked.
5. The transfer record and balanced ledger journal are created in one database transaction.
6. The account balance projection is updated in the same transaction.
7. After commit, notification work is published asynchronously.
8. The frontend displays the authoritative backend result.

Core invariants:

- Every journal has equal total debits and credits.
- Ledger entries are immutable.
- Reversals create compensating entries instead of editing history.
- A unique idempotency key prevents duplicate transfer execution.
- Ledger changes and balance projections commit atomically.
- The frontend never calculates the authoritative balance.
- Reconciliation detects divergence between projections and the ledger.
- Sensitive administrator actions always create audit records.

## Failure Scenarios

The project deliberately handles and tests:

- Insufficient balance.
- Frozen source or destination accounts.
- Duplicate requests.
- Concurrent transfers competing for the same balance.
- Database failure before commit.
- Notification or queue outage.
- Expired authentication.
- Access to another user's account.
- Repeated reversal attempts.
- Divergence between stored balance and ledger entries.

API errors use a stable contract containing a machine-readable code, safe message, trace identifier, and timestamp. Internal stack traces, queries, secrets, and tokens are never exposed to the browser.

## Security Design

- Spring Security provides authentication and authorization.
- Passwords use Argon2 or bcrypt hashing.
- Browser credentials use secure, HttpOnly cookies.
- CSRF protection is enabled for cookie-authenticated requests.
- Login and transfer endpoints are rate-limited.
- All monetary validation and authorization happen on the backend.
- Secrets are supplied through environment variables and are excluded from source control.
- HTTPS is mandatory outside local development.
- Dependency scanning runs in CI.
- Database backups are stored off-server and restoration is practiced.

## Testing Strategy

- Unit tests cover domain policies, limits, approval, ledger invariants, and reversal rules.
- Integration tests use real PostgreSQL through Testcontainers.
- Concurrency tests attempt overspending and duplicate execution.
- API contract tests verify validation, status codes, authorization, and safe errors.
- Playwright tests exercise login, transfer, history, and administrator workflows.
- k6 tests measure behavior under concurrent transfer load.
- Failure-injection exercises stop dependencies and verify recovery behavior.

Coverage is treated as supporting evidence. Critical financial behavior must be tested thoroughly even if the repository-wide percentage target has already been reached.

## Deployment Design

Local development runs the full environment through Docker Compose. The low-memory VPS deployment runs only the components required for the current learning stage:

- Caddy serving the frontend and proxying the API.
- Spring Boot API with a bounded JVM heap.
- PostgreSQL.
- Redis.
- RabbitMQ only when asynchronous exercises require it.

Heavy dashboards such as Grafana may run locally or through a free hosted service to avoid exhausting a 2 GB VPS. CI performs formatting, tests, dependency scanning, and image builds. Deployment performs migrations, rollout, health verification, and rollback when health verification fails.

## Definition of Done

A feature is complete only when:

- Its business rules work.
- Inputs are validated.
- Authorization is enforced.
- Relevant automated tests pass.
- Errors are handled through the standard contract.
- Logs and metrics make failures diagnosable.
- API and user documentation are updated.
- The feature runs in the containerized environment.

## Four-Month Spiral Roadmap

### Month 1: ship the complete vertical slice

Week 1 connects a Spring Boot backend, PostgreSQL, Next.js frontend, Docker Compose environment, domain, and HTTPS deployment. Week 2 implements users, wallets, balanced ledger journals, simulated deposits, transfers, history, and the main frontend workflow. Week 3 adds atomic transactions, locking, idempotency, reversal, reconciliation, Redis, optional RabbitMQ, and core automated tests. Week 4 adds CI/CD, security controls, backup/restore, observability, end-to-end tests, documentation, and a public portfolio demo.

End state: LedgerFlow v1 is online and demonstrates an end-to-end transaction workflow.

### Month 2: break and harden the system

The system is subjected to duplicate requests, concurrent transfers, overspending attempts, queue failure, database restart, repeated reversal, authorization attacks, slow queries, and load. Domain boundaries and data models are refactored based on evidence from these exercises.

End state: critical invariants survive automated concurrency and failure tests.

### Month 3: scale and operate

Add an outbox pattern, robust worker processing, deliberate caching, alerting, performance tuning, automated rollout and rollback, infrastructure as code, incident response exercises, and a small Go reconciliation CLI if the primary milestones remain on schedule.

End state: the student can deploy, monitor, diagnose, restore, and explain the system rather than merely demonstrate its happy path.

### Month 4: specialize and compete

Polish architecture and security, complete system-design exercises, contribute to open source, create portfolio materials, practice technical interviews, and apply for internships. A separate experimental branch may adapt LedgerFlow for a Web3 hackathon without contaminating the core ledger design. Local Kubernetes exploration is allowed only after the core deployment and operations goals are complete.

End state: a professional repository, live demo, architecture explanation, technical write-up, demonstration video, and internship-ready narrative.

## Weekly Operating Rhythm

A normal 18-hour week uses approximately:

- 4 hours for concepts and primary documentation.
- 8 hours for implementation.
- 3 hours for testing and debugging.
- 1 hour for documentation and portfolio evidence.
- 2 hours for Web3, hackathon preparation, or technical exploration.

Every learning session must produce at least one durable artifact: a commit, automated test, technical note, benchmark, diagram, incident record, or architectural decision. Tutorial work must be reimplemented without following the source line by line.

## Success Criteria

At semester end, the student can:

- Explain HTTP, SQL transactions, locking, idempotency, ledger invariants, queues, container networking, and deployment failure modes.
- Build and test a Java/Spring backend and a TypeScript/Next.js frontend.
- Deploy the system securely on Linux with containers and HTTPS.
- Diagnose failures through logs and metrics.
- Restore data from a tested backup.
- Explain security boundaries and known limitations.
- Present LedgerFlow confidently in an internship interview or adapt relevant components for a hackathon.
