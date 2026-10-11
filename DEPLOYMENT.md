# Deploy the personal portal on Render and Neon

This deployment serves one private FXUNIFI account. It runs without your laptop and can be opened from a mobile browser. It imports records on sign-in and supports **Sync now** on the dashboard and Account sync page. It does not continuously run background sync or execute financial actions.

## 1. Prepare GitHub

Push the application code, including `render.yaml`, to https://github.com/shubhamsharma28198-wq/trade_value. Do not upload `.env` files, `.claude`, `.tradevault-local`, logs, or imported data. A GitHub connection with write access is required for Codex to push.

## 2. Create Neon

Create a free project at https://console.neon.tech and copy its PostgreSQL connection string. Save that string as Render's private `DATABASE_URL` variable. Use a separate database for this portal.

On startup, the portal creates two tables if they do not already exist:

- `tradevault_portal_snapshots`: the latest complete mapped import for your account.
- `tradevault_portal_sessions`: hashed session tokens with expiration and password-version checks.

Imports and sessions survive Render restarts because they are stored in Neon, not the hosting filesystem. Credentials are not stored in either table.

## 3. Choose a separate portal password

In an interactive terminal in this project, run:

```powershell
node apps/web/scripts/hash-password.mjs
```

Type a password of at least 12 characters. The terminal does not echo it. Copy the resulting `scrypt$...` value into Render's `PORTAL_PASSWORD_HASH`. Use a password different from your original FXUNIFI password. Do not put either password in GitHub.

## 4. Create Render service

At https://dashboard.render.com, create a Blueprint from the repository. `render.yaml` selects a free Node web service with `apps/web` as its root. Provide these private variables when prompted:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Your Neon PostgreSQL connection string |
| `PORTAL_USERNAME` | The username you choose for this private portal |
| `PORTAL_PASSWORD_HASH` | The value generated in step 3 |
| `FXUNIFI_USERNAME` | Your original-site username |
| `FXUNIFI_PASSWORD` | Your original-site password |

Render supplies `RENDER_EXTERNAL_URL` and `PORT`. The portal uses that HTTPS URL as its allowed origin. If using a custom domain, set `APP_URL=https://your-domain.example` and open that domain consistently.

For manual Render setup, choose these settings:

```text
Runtime: Node
Root directory: apps/web
Build command: npm install --prefix . --omit=dev --workspaces=false && node scripts/build.mjs
Start command: node server.mjs
Health check: /health
```

Also set `NODE_ENV=production`, `PORTAL_MODE=hosted`, and `NODE_VERSION=24.21.0`.

## 5. Open and verify

Open the Render HTTPS URL on your phone. Sign in with the **portal** username and password, not your FXUNIFI credentials. The first sign-in starts a read-only import. Wait for the successful-sync notice, then review wallet amounts against the original website. Later, press **Sync now** on the dashboard whenever you need fresh records.

Free Render services sleep after idle time, so opening a sleeping service can take about a minute. There is no guarantee of uninterrupted free hosting. Limits and plans can change. Neon free compute also has usage limits.

The connector was verified locally against FXUNIFI. Authentication from Render's network still needs a live check after deployment. Original-site challenges, OTP, IP restrictions, or layout changes can prevent sync; the portal reports the failure and keeps the last complete import. It does not bypass verification challenges.

## Checks completed and outstanding

Automated tests cover hosted origin restrictions, separate portal credentials, secure cookies, persistent-session behavior, SQL parameters, hidden database errors, account mapping, retained data after failed sync, and dashboard sync controls. Local web builds pass. A real Neon database and deployed Render instance have not yet been tested.

The separate Express/Prisma/Redis API remains optional for this personal hosted mode. Render does not start those services; the deployed personal portal authenticates and synchronizes through the web package directly.
