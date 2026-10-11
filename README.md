# TradeVault member portal

TradeVault is a member dashboard with sign-in and registration, wallet balances, transaction filters and CSV export, left/right referral links, referral member search, a binary tree, editable profiles, account sync status, and administrator views for users, transactions, sync jobs, and audit logs.

The frontend uses HTML, CSS, JavaScript modules, and a small Node server. The backend uses Express, Prisma/PostgreSQL, Redis, and BullMQ. The frontend proxies `/api` to the backend so cookies work on the same origin.

For mobile access without keeping your laptop on, use the personal Render/Neon mode described in [DEPLOYMENT.md](DEPLOYMENT.md). It has a separate private portal login, persistent Neon snapshots and sessions, automatic sync on sign-in, and **Sync now** on the dashboard. The production configuration is prepared; a live Render/Neon deployment still needs account setup and verification.

## Preview immediately

From this folder, with Node 22.9 or newer:

```powershell
node apps/web/server.mjs
```

Open http://localhost:3000 and choose **Explore demo dashboard**. No installation, database, credentials, or external service is needed. Demo mode is visibly labeled. Sample profile edits are kept in memory for the current page session; reloading resets them. The demo preference remains until you sign out. Demo referral links are placeholders.

## Run connected accounts locally

Install Node 22.9+ and Docker Desktop, then run:

```powershell
Copy-Item .env.example .env
npm install
docker compose up -d postgres redis
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

The website runs at http://localhost:3000; API health is at http://localhost:4000/health. `db:push` is for a fresh local development database. Use reviewed migrations for an existing database or production deployment.

Development seed credentials:

| Account | Username | Password |
|---|---|---|
| Member | demo_user | password123 |
| Admin | admin | admin1234, or the value of SEED_ADMIN_PASSWORD |

Seeding is refused when `NODE_ENV=production`. It creates sample wallets, transactions, and referral records without overwriting existing accounts or duplicating records. Seed wallet totals are illustrative snapshots rather than balances calculated from the sample transaction list.

New accounts start with an empty wallet and receive left/right referral links. Registering through one of those links adds the new member to the sponsor’s chosen team. Placement uses the first available parent in that team, with at most two children per parent. This is local referral placement, not a reproduction of any unverified FXUNIFI compensation rules.

## Build and check

```powershell
npm test
npm run build
npm run typecheck
npm start
```

`npm test` uses Node’s test runner without subprocess isolation so it can also run in restricted environments. Tests cover portal page rendering in a DOM harness, demo filters, CSV escaping, session refresh behavior, static assets, API proxying, and offline errors. The harness does not verify browser layout.

The web assets can be built independently with `node apps/web/scripts/build.mjs`. Backend type checking requires installed dependencies and the generated Prisma client; build shared packages first.

For all services in Docker, first initialize the local database using the steps above, then stop `npm run dev` and run:

```powershell
docker compose --profile full up --build -d
```

The Docker stack uses the same PostgreSQL/Redis volumes. There is no automatic schema migration or seed step at container startup.

## Configuration and integration boundaries

Enter your original-site username and password in .env.fxunifi.local (excluded from Git and Docker). On the login screen, enter those same credentials and choose **Use saved FXUNIFI credentials**. Login automatically starts a real read-only FXUNIFI sync. Use **Account sync → Sync now** for subsequent refreshes. The connector authenticates through the form endpoint observed on the original sign-in page, maintains its own in-memory cookies, and imports the profile, wallet snapshots, left/right teams, account statement, deposit history, and withdrawal history. It does not execute trades, payments, transfers, or original-site profile changes.

Mapped snapshots are stored privately in .tradevault-local/accounts and survive restarts; last successful data stays visible if a refresh fails. Local sessions expire after an hour and reset when the server restarts. This mode is restricted to loopback connections and disabled in production. OTP/challenge changes or changes to the original site's layout may require a connector update; they are reported as errors. Unsupported fields remain unavailable rather than being fabricated. Browser cookies, bank account fields, and passwords are not stored in the imported snapshots. Do not paste credentials into chat.

Use `.env.example` for database, Redis, JWT, ports, and app URLs. Keep `.env` out of version control. Set long, distinct `JWT_SECRET` and `JWT_REFRESH_SECRET` values for production; placeholder secrets are rejected. Refresh sessions are stored as hashes, rotated on refresh, and revoked on logout. Access tokens refer to a live session and inactive users lose access.

The local FXUNIFI connector above is connected and was verified against the user's authenticated account. The separate PostgreSQL/BullMQ worker remains a mock connectivity check: with MOCK_EXTERNAL_PROVIDER=true it imports no identities or balances; its live mode is not configured. Payment execution, password recovery, and email delivery are not connected.

The live reference `https://fxunifi.com/members/` could not be viewed in the development environment. The user subsequently supplied dashboard screenshots. The portal now follows their dark matrix background, yellow accents, narrow icon sidebar, square panels with yellow corner marks, member/rank block, balance cards, stacked referral links, metric grid, bonus distribution chart, earnings meter, and top referrals table. Sample member details remain isolated in demo mode; connected pages display account records. Unsupported provider metrics are labeled as unconnected.

## Review and validation status

Latest completion pass (2026-10-11): 29 automated tests pass and the web build succeeds. Real local FXUNIFI authentication, snapshot import, and all imported account routes were verified against the original account. The imported wallet UI renders its balances in the DOM test harness. Fixed left/right tree placement, session handling after refresh, inactive-account sync failures, credential-reference exposure in admin details, and atomic profile audit logging. Connected members can change their password from My profile; this revokes all sessions and requires signing in again. Changed backend files passed syntax validation, but dependency installation is still blocked by the environment's network configuration. Docker and a connected browser are unavailable, so backend type checking, database integration, and visual browser verification remain unverified.

The starting project had no frontend, no TypeScript configuration, an invalid Prisma datasource and missing relations, broken shared imports, an invalid worker implementation, inconsistent JWT secrets, unavailable Docker paths, and sample data presented by ordinary account endpoints. These have been addressed in the code.

Frontend/server tests and web asset checks were run locally. Package registry access was blocked, so dependency installation, Prisma validation/generation, backend compilation, database integration tests, Docker builds, and browser visual inspection could not be performed here. Run the connected setup and build commands above before deploying.
