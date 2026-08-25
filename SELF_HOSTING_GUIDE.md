# Joy Client Payroll Manager — Own Hosting and Online Editing Guide

This setup keeps the complete source code under Joy's control and lets an authorised person edit the application from a browser. It uses:

- a **private GitHub repository** for source code and change history;
- **GitHub Codespaces** for a browser-based Visual Studio Code editor;
- a **Cloudflare Worker** for the application;
- **Cloudflare D1** for payroll data;
- **Cloudflare Access** for secure company sign-in; and
- `payroll.joyindia.in` as the recommended company address.

The current ChatGPT-hosted application can remain available until the Joy-owned version is tested and approved.

## 1. Create the private source repository

1. Sign in to GitHub using the account Joy will retain long term.
2. Create a **Private** repository named `joy-client-payroll`.
3. Upload or push this complete source project to that repository.
4. Add at least one second trusted Joy administrator as a repository owner or maintainer.
5. Keep payroll exports, database backups, passwords, tokens, and real employee files outside GitHub.

## 2. Open the online editor

1. Open the private repository in GitHub.
2. Select **Code → Codespaces → Create codespace on main**.
3. Wait for the browser version of Visual Studio Code to open. Dependencies and a local test database are prepared automatically.
4. Open **Terminal → Run Task → Joy Payroll: Start application**.
5. Open the forwarded **Joy Payroll application** port when GitHub shows it.

The online editor signs in locally as `praveen.red.07@gmail.com` and uses a separate local database. It does not connect to the production payroll database.

## 3. Create the Cloudflare database

In the Codespaces terminal:

```bash
npx wrangler login
npx wrangler d1 create joy-client-payroll-db
```

Cloudflare returns a database ID. Open `wrangler.self-hosted.jsonc` and replace:

```text
00000000-0000-4000-8000-000000000000
```

with that exact database ID.

Do not put the database ID into a password field; it belongs only in the D1 configuration shown above.

## 4. Create the protected Worker before publishing payroll code

1. In Cloudflare, open **Workers & Pages**.
2. Create a basic Worker named exactly `joy-client-payroll`.
3. Open that Worker's **Access** tab and protect **All traffic**.
4. Allow only approved Joy email addresses or the approved Joy company email domain.
5. In Cloudflare Zero Trust, copy:
   - the team domain, for example `https://joy.cloudflareaccess.com`; and
   - the Access application's **AUD tag**.
6. In `wrangler.self-hosted.jsonc`, replace `YOUR-TEAM` and `REPLACE_WITH_ACCESS_AUD_TAG` with those exact values.

The application validates the signed Access token itself. An email header alone is not trusted.

## 5. Create the production tables

After all three values in `wrangler.self-hosted.jsonc` have been updated, run:

```bash
npm run db:migrate:remote
```

Run this command again only when a reviewed future feature includes a new Drizzle migration.

## 6. Connect GitHub to automatic hosting

1. Commit and push the updated configuration to the private GitHub repository.
2. In Cloudflare open `joy-client-payroll` → **Settings → Builds → Connect**.
3. Select the private `joy-client-payroll` repository.
4. Use the following commands:

| Setting | Value |
|---|---|
| Production branch | `main` |
| Build command | `npm ci && npm run build:self-hosted` |
| Deploy command | `npx wrangler deploy` |
| Root directory | `/` |

5. Save and deploy.

Every approved change merged to `main` will be built and deployed automatically. Use a separate feature branch for unfinished work so an accidental edit does not immediately change production payroll.

## 7. Connect the Joy domain

After the Worker is working:

1. Open the Worker's **Settings → Domains & Routes**.
2. Add the custom domain `payroll.joyindia.in`.
3. Confirm that Cloudflare Access protects this custom domain as well as the `workers.dev` address.
4. Keep the ChatGPT-hosted version available until Joy finishes one complete test payroll month on the new domain.

## 8. First production login and user roles

1. Sign in first using `praveen.red.07@gmail.com`; the first authorised human becomes Super Admin.
2. Open **Users & Access**.
3. Add Payroll Team and HR Team users by their exact email addresses.
4. Give each module No access, View only, or Full access.
5. Give final payroll approval only to specifically authorised people.
6. Add the same people to the Cloudflare Access policy. Both controls must permit the user.

## 9. Safe online feature changes

For every new feature:

1. Create a GitHub Issue using **Payroll feature request**.
2. Create a branch such as `feature/attendance-import-check`.
3. Open that branch in Codespaces.
4. Ask GitHub Copilot or a developer to follow `.github/copilot-instructions.md`.
5. Use synthetic test information only.
6. Run **Terminal → Run Task → Joy Payroll: Run all checks**.
7. Open a pull request and review the calculation, permissions, database migration, and audit behavior.
8. Merge to `main` only after approval; Cloudflare then publishes it automatically.

Example request for an AI coding assistant:

> Add a weekly shift-import screen for HR Team. Validate employee code, date, active shift, duplicate entries, and approved payroll lock. Payroll Team should have View only access. Add server permission checks, audit events, and tests. Do not change existing salary calculations.

## 10. Backup and recovery

Before a major payroll rule or database change, export D1 from an authorised Codespace:

```bash
mkdir -p backups
npx wrangler d1 export DB --remote --output=backups/joy-payroll-backup.sql --config wrangler.self-hosted.jsonc
```

The `backups` folder is excluded from Git. Move the backup to Joy's approved encrypted storage and delete it from Codespaces after verification.

## Production rules

- Keep the GitHub repository private.
- Require two-factor authentication for GitHub and Cloudflare administrators.
- Never use real payroll data in local development, screenshots, issues, or AI prompts.
- Keep at least two trusted owners for account recovery, but minimise day-to-day administrator access.
- Test one complete parallel payroll month before using the new system for salary disbursement.
- Back up D1 before schema changes and before the first production payroll of each month.
- Do not directly edit the production database to correct salary. Use application workflows so the audit history remains complete.
