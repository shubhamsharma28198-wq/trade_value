# Project review

## Render/Neon implementation

- Added single-account hosted mode with a private portal password separate from source credentials, scrypt verification, login rate limits, exact HTTPS origin checks, secure cookies, and database-backed session expiration/revocation.
- Added Neon snapshot storage so the latest successful import and signed-in sessions survive a Render restart. Source credentials remain environment secrets and session tokens are stored as hashes.
- Added a Render Blueprint, hosting port binding, health checks, and deployment instructions.
- Sync runs on sign-in or through **Sync now** on the dashboard and Account sync page. There is no continuous background scheduler in this mode.
- All 36 tests pass and the web build succeeds. Hosted tests use an injected database boundary; a live Neon connection and deployed FXUNIFI login remain unverified until hosting credentials are configured.

## Verified local FXUNIFI connection

The local portal now authenticates through the original website's observed form endpoint and imports read-only account data without additional dependencies. The live account import and localhost account routes were verified: profile and wallet, 387 team records, 1,072 statement records, 24 withdrawals, and 2 trading deposit records. Those counts describe the initial import and may change on future syncs.

Snapshots remain separate from demo fixtures and the PostgreSQL account backend. Credentials and original bank details are excluded from snapshots; cached records are stored in the ignored .tradevault-local directory. Login initiates refresh automatically; Account sync supports manual refresh and reports failures while retaining the previous complete import. Changed source layouts and wrong account identities fail without overwriting balances. The separate queue worker is still mock-only.

29 automated tests pass, including original-site origin restrictions, source parsing, concurrent sync, failed-refresh preservation, imported page rendering, and visible wallet balances. Live route checks pass and the web build succeeds. Visual browser inspection and PostgreSQL integration remain unverified.

## Completion pass — 2026-10-11

- 20 automated tests pass; web asset build and changed backend syntax checks pass.
- Corrected right-only binary-tree placement and extreme branch navigation, with regression tests.
- Preserved authenticated sessions when a retried request fails after successful token refresh.
- Sync runs now record inactive/deleted-account failures and clear old completion timestamps on retries.
- Admin account details exclude encrypted credential references.
- Profile fields have length limits; profile edits and audit records commit together.
- Added current-password-verified password changes with concurrent-change protection, session revocation, and audit logging.
- Dependency downloads fail with a refused network connection. Docker and connected browsers are unavailable. Backend compilation and database-backed password changes remain unverified.

## Addressed in this change

| Finding | Change |
|---|---|
| The root scripts referred to a website package that did not exist. | Added a responsive member portal, a dependency-free preview server, and npm workspace commands. |
| No package had a TypeScript build configuration. | Added shared and per-package configurations, package exports, and a database entry point. |
| Prisma used `source` instead of `datasource`, had ambiguous/missing relationships, and generated into a path that did not match API imports. | Corrected the datasource, relations, uniqueness constraints, session model, and client output. |
| Most routes verified JWTs a second time with a different fallback secret. | Routes use the authenticated member; account role/status are read from the database. |
| Login issued a refresh cookie but refresh expected a token in the request body. Logout did not revoke sessions. | Refresh accepts the HttpOnly cookie, rotates hashed database sessions, and logout revokes the session. |
| Admin responses exposed password hashes. | Removed password hashes from responses and prevented administrators from disabling their own account. |
| The rate limiter imported unavailable symbols and was exported under the wrong name. | Replaced it with a configured Express limiter. |
| Shared currency code relied on an undeclared Prisma runtime dependency. | Uses decimal.js with two-decimal rounding. |
| Worker imports pointed to missing files; it used callback processing, `worker.add`, an invalid Redis option, and an undefined users variable. | Replaced it with a BullMQ queue, async worker, periodic scheduling, failure tracking, and shutdown cleanup. |
| Manual sync and retry routes changed status without actually queuing jobs. | Enqueue work for the worker. |
| Referrals, tree nodes, market data, and wallet percentage changes were fabricated in connected-account responses. | Connected pages use stored account data; mock data is isolated in visibly labeled frontend demo mode. |
| Seed users had no wallets, transactions, or referral links. | Added repeatable development fixtures, including wallets for all seeded accounts. |
| Docker referenced missing Dockerfiles and nginx configuration; Redis health checks omitted authentication. | Added Dockerfiles, authenticated Redis checks, local port bindings, and a runnable compose layout. |

## Validation

13 automated tests passed. Web build and JavaScript syntax checks passed. All 33 TypeScript source files parsed successfully; this is a syntax check, not type checking. The local preview returned HTTP 200 for the portal and styles.

Dependency downloads are blocked in this environment, and no connected browser or Docker installation was available. Backend compilation, Prisma validation, database-backed authentication/referral flows, worker integration, Docker builds, and visual layout still require verification using the README steps.

## Remaining integration work

- Exact FXUNIFI appearance cannot be verified because the members reference page was inaccessible. Screenshots of its authenticated pages would allow a closer match.
- Live FXUNIFI account import requires an authorized API/connection flow. The current worker only tests the demo queue workflow and imports zero records.
- Payment processing, deposit/withdrawal execution, password recovery, and email delivery require service choices and credentials.
- Financial balances are stored snapshots; a provider or payment integration must define authoritative ledger and reconciliation rules before money operations are enabled.
- Refresh rotation is single-use. Multiple browser tabs refreshing the same session concurrently may require cross-tab coordination.
- Queue creation is not a transactional outbox. A crash between database run creation and queue insertion can leave a pending run requiring reconciliation; production deployment should add that recovery path.
- The full Docker image installs dependencies without a lockfile because package installation was unavailable. Generate and commit a lockfile after the first successful install.

## Credential finding

An API credential is stored in plaintext in `.claude/settings.local.json`. Rotate that credential. The `.claude` directory is now excluded from Git and Docker build contexts; the settings file itself was left intact.
