# Joy Client Payroll Manager

A full-stack payroll application for multiple clients and employer units. It combines employee master data, daily attendance, configurable shifts, salary calculation, accommodation recoveries, approval, payments, and payslips in one persistent system.

## User roles and access

The first signed-in human user is created automatically as the first **Super Admin**. Automated hosting-preview accounts are blocked and cannot claim this role. A Super Admin can open **Users & Access** and add another person by their exact sign-in email.

Each profile starts with one of these roles:

- **Super Admin**: full control of every module and final payroll approval.
- **Payroll Team**: payroll processing, accommodation, payments, and supporting read access. Final approval is off by default.
- **HR Team**: attendance, employees, accommodation, shifts, and remarks, with payroll view access.

Every non-admin role can then be customised module by module:

- **No access**: the module is hidden and its API data/actions are blocked.
- **View only**: records can be reviewed, but changes and protected exports are blocked.
- **Full access**: create, edit, import, export, activate, deactivate, and delete actions are allowed for that module.

Final payroll approval is a separate permission and also requires Full access to Payroll Run.

To onboard a person to the hosted Site:

1. Add their exact email in **Users & Access**.
2. Select a role and customise module access.
3. Enable final payroll approval only for an authorised approver.
4. Invite the same email through the Site's sharing/access list.
5. Ask the person to sign in with that email.

## Own hosting and online editing

The project now supports two deployment targets without maintaining separate codebases:

- **ChatGPT Sites** uses verified ChatGPT identity and the existing Sites-managed D1 database.
- **Joy-owned Cloudflare hosting** uses Cloudflare Access, a Joy-owned D1 database, a private GitHub repository, and GitHub Codespaces for browser-based editing.

Follow [SELF_HOSTING_GUIDE.md](SELF_HOSTING_GUIDE.md) to create the private GitHub repository, online editor, protected Worker, D1 database, automatic deployment, custom domain, first Super Admin, backups, and safe feature-change workflow.

For local development:

```bash
npm ci
npm run db:migrate:local
npm run dev:self-hosted
```

Use `npm test` and `npm run test:self-hosted-auth` before publishing. Database changes are stored as Drizzle migrations under `drizzle/`; production must apply all migrations in order to the D1 database bound as `DB`.

`app/auth.ts` accepts the existing verified ChatGPT Sites identity or a cryptographically verified Cloudflare Access JWT. The self-hosted path validates signature, issuer, application audience, expiry, and email before the identity reaches application authorization.

Important source locations:

- `app/payroll-app.tsx`: application screens and user interactions
- `app/api/app-data/route.ts`: secured payroll API and permission enforcement
- `app/auth.ts`: dual-host authenticated identity adapter
- `lib/access-control.ts`: roles, defaults, and module permission rules
- `lib/cloudflare-access.ts`: Cloudflare Access JWT validation
- `lib/payroll-calculations.ts`: salary and attendance calculations
- `lib/excel-import.ts`: workbook import mapping
- `db/schema.ts`: database tables
- `drizzle/`: database migrations
- `tests/`: workbook, workflow, role, and authorization tests
- `wrangler.self-hosted.jsonc`: Joy-owned Cloudflare Worker, D1, and Access settings

## Technical runtime

A clean full-stack starter running on
[vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and
Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`
- Linux with `flock`, `curl`, and GNU `timeout`

## Sites Lifecycle

The Sites lifecycle CLI runs the locked dependency install before returning this checkout. Edit the source under `app/`, then checkpoint when a coherent milestone is ready to inspect or share. The remote Sites builder runs `npm run build` against the pushed commit. Do not repeat install or build as a normal pre-checkpoint step.

This starter does not use `wrangler.jsonc`.

`install:ci` is intentionally a single, non-retrying `npm ci`. It refuses a concurrent install for the same project, consumes a matching image-seeded npm cache with `--prefer-offline` while retaining registry fallback for a missing cache object, otherwise downloads and verifies the complete vinext tarball recorded in `package-lock.json`, limits npm to one socket, and terminates a stalled install. `build` applies a short timeout. These helpers target Linux and use GNU `timeout`; they are not native macOS scripts.

Scripts that need writable project-scoped home, npm, XDG, and temporary paths use `scripts/sites-env.sh`. The `dev` and `start` scripts honor the caller's runtime environment and keep Wrangler logs inside the checkout. The generated `.sites-runtime/` directory is disposable and ignored by Git.

## Included Shape

- edit site code under `app/`
- `app/chatgpt-auth.ts` provides optional dispatch-owned ChatGPT sign-in helpers
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/index.ts` reads the D1 binding from the Cloudflare Worker environment
- `db/schema.ts` starts intentionally empty
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

OpenAI workspace sites can read the current user's email from
`oai-authenticated-user-email`.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Diagnostic Commands

- `npm run install:ci`: perform the one bounded lockfile install
- `npm run dev`: start the Vite/Vinext development server
- `npm run build`: build the deployable Sites artifact
- `npm run start`: start the built Vinext application
- `npm test`: build and verify the rendered development-preview metadata
- `npm run db:generate`: generate Drizzle migrations after schema changes

Use build commands for targeted diagnosis after a remote failure, not as part of the normal checkpoint path.

The timeout defaults can be overridden for a controlled canary with `SITES_INSTALL_TIMEOUT`, `SITES_INSTALL_KILL_AFTER`, `SITES_BUILD_TIMEOUT`, and `SITES_BUILD_KILL_AFTER`. A timeout fails the command; the helpers never retry an unchanged install or build.

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
