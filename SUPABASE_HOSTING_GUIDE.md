# Joy Payroll — Supabase and Your Existing Hosting: Step-by-Step

Your independent production address will be:

**https://payroll.joycorporatesolutions.com**

This installation uses your existing website hosting for the payroll website and
your own Supabase account for the database, secure email/password login, and
server-side payroll application. Your existing company website remains unchanged.

| Component | Where it runs | Who controls it |
| --- | --- | --- |
| Payroll website and domain | Your existing cPanel/hosting account | Joy Corporate Solutions |
| Employee, attendance, and salary database | Your Supabase PostgreSQL project | Joy Corporate Solutions |
| Individual user passwords | Supabase Authentication | Each authorised user |
| Payroll calculation and permission API | Supabase Edge Function | Joy Corporate Solutions |
| Source code and online changes | Your private GitHub repository/Codespaces | Joy Corporate Solutions |

Your nameservers can remain:

```text
ns1.mysecurecloudhost.com
ns2.mysecurecloudhost.com
```

You do not need to move the entire `joycorporatesolutions.com` domain to
Cloudflare, purchase a Supabase custom domain, or keep using ChatGPT sign-in.

## Step 1 — Download and keep the full source code

Keep the complete Joy Payroll source archive provided with this delivery. Extract
it on your computer or upload its contents to a private GitHub repository named,
for example, `joy-client-payroll`.

The essential Supabase files are:

```text
supabase/migrations/202608250001_joy_payroll.sql
supabase/functions/payroll-api/index.ts
supabase/functions/payroll-api/supabase-runtime.ts
supabase/functions/payroll-api/deno.json
supabase/config.toml
supabase-frontend/public/config.js
SUPABASE_HOSTING_GUIDE.md
```

The full original payroll application remains the source of truth: payroll
calculations, Excel import, accommodation, approval, users, and permissions are
automatically prepared for Supabase by `npm run prepare:supabase`.

## Step 2 — Create your own Supabase account and project

1. Open [Supabase](https://supabase.com/dashboard).
2. Sign in using a company-controlled email address.
3. Create an organisation owned by Joy Corporate Solutions.
4. Select **New project**.
5. Project name: `joy-client-payroll`.
6. Choose the nearest suitable region available for your organisation.
7. Create a strong database password and save it in Joy's password manager.
8. Wait until the project becomes ready.

Do not send the database password to ChatGPT or place it in a GitHub file.

## Step 3 — Copy the two browser-safe connection values

Inside the Supabase project:

1. Open **Project Settings → API Keys** or **Connect**.
2. Copy the **Project URL**, which resembles:

   ```text
   https://abcdefghijklmnopqrst.supabase.co
   ```

3. Copy the **Publishable key**. It normally begins with `sb_publishable_`.
   If your existing project only displays legacy keys, the public `anon` key is
   the compatible browser-safe alternative.
4. Note the **Project reference**: the letters before `.supabase.co`.

Never use a **Secret key**, **service_role key**, or database password as the
publishable key. Those must never appear in browser-accessible files.

## Step 4 — Create all payroll database tables

1. Open **SQL Editor** in the Supabase project.
2. Select **New query**.
3. Open this source file:

   ```text
   supabase/migrations/202608250001_joy_payroll.sql
   ```

4. Copy its complete contents into the SQL Editor.
5. Select **Run**.
6. Open **Table Editor** and confirm these tables exist:

   ```text
   app_users
   vendors
   client_units
   employees
   shift_definitions
   payroll_remarks
   payroll_rules
   attendance_entries
   payroll_runs
   payroll_items
   accommodation_charges
   audit_events
   ```

The `vendors` database table is displayed as **Clients** throughout the app.
Row Level Security is enabled on every table, and browser users cannot query
salary tables directly.

The initial application Super Admin profile is:

```text
praveen.red.07@gmail.com
```

This profile is not yet a password account. Create its secure Auth account next.

## Step 5 — Configure password-based sign-in

1. Open **Authentication → Providers → Email**.
2. Enable email/password authentication.
3. Disable public self-registration where the dashboard offers **Allow new
   users to sign up**. Only company administrators should create or invite users.
4. Open **Authentication → URL Configuration**.
5. Set **Site URL** to:

   ```text
   https://payroll.joycorporatesolutions.com
   ```

6. Add this redirect URL:

   ```text
   https://payroll.joycorporatesolutions.com/**
   ```

7. Open **Authentication → Users → Add user → Create new user**.
8. Enter:

   ```text
   praveen.red.07@gmail.com
   ```

9. Enter a strong private password.
10. Enable **Auto Confirm User** when that option appears.
11. Save the user.

You will use this email and your private password to sign in. ChatGPT login is
not required.

For production email invitations and password resets, configure Joy's approved
SMTP provider under Supabase authentication email/SMTP settings.

## Step 6 — Open the source code in an online editor

The recommended online editor is GitHub Codespaces:

1. Create a **private** GitHub repository for the extracted Joy Payroll source.
2. Upload the complete source project.
3. Open the repository on GitHub.
4. Select **Code → Codespaces → Create codespace on main**.
5. Wait for the online editor to start.
6. Open **Terminal → New Terminal**.
7. Install the application dependencies:

   ```bash
   npm ci
   ```

Use only a private repository. Do not upload real employee Excel files,
passwords, secret keys, production database exports, or payroll reports.

## Step 7 — Deploy the Supabase payroll API

In your Codespaces terminal, first prepare the existing complete payroll logic
for the Supabase Edge Function:

```bash
npm run prepare:supabase
```

Sign in to the Supabase CLI:

```bash
npx supabase@latest login
```

Your browser will request authorisation. Approve it yourself; do not paste
access tokens into this chat.

Link the project, replacing `YOUR_PROJECT_REF` with your actual reference:

```bash
npx supabase@latest link --project-ref YOUR_PROJECT_REF
```

If asked for the database password, enter it privately in the terminal.

Set the website origin allowed to call the payroll API:

```bash
npx supabase@latest secrets set APP_ORIGIN=https://payroll.joycorporatesolutions.com
```

Deploy the complete API:

```bash
npx supabase@latest functions deploy payroll-api
```

Open **Edge Functions** in the Supabase dashboard and confirm `payroll-api` is
listed. Keep JWT verification enabled.

Supabase automatically supplies its own server-side project URL, database URL,
and secret credentials to the Edge Function. Do not add those values to
`config.js` or expose them in GitHub.

## Step 8 — Build the website files

In the same Codespaces terminal, run:

```bash
npm run build:supabase
```

The ready-to-upload website will be created inside:

```text
dist-supabase/
```

It contains an `index.html`, an `assets` folder, and a public `config.js` file.

Download that folder from Codespaces. If a ready-to-upload website ZIP was
included with your delivery, you can use that ZIP directly instead of building
the files yourself.

## Step 9 — Create the payroll subdomain in your existing hosting account

1. Sign in to the hosting account associated with:

   ```text
   ns1.mysecurecloudhost.com
   ns2.mysecurecloudhost.com
   ```

2. Open **cPanel → Domains** or **Subdomains**.
3. Select **Create a New Domain** or **Create Subdomain**.
4. Enter:

   ```text
   payroll.joycorporatesolutions.com
   ```

5. Disable **Share document root with joycorporatesolutions.com**, if offered.
6. Choose a separate document root, for example:

   ```text
   public_html/payroll
   ```

7. Save the subdomain.

Most cPanel accounts automatically create the correct DNS record for a
subdomain hosted on that same account. If it does not appear:

1. Open **cPanel → Zone Editor**.
2. Find the hosting server's IP address under cPanel **General Information** or
   ask your hosting provider for the IP.
3. Create an **A record**:

   | Field | Value |
   | --- | --- |
   | Name | `payroll` |
   | Type | `A` |
   | Address | Your existing hosting server's exact IP address |

Do **not** point this cPanel-hosted installation at `custom-domains.chatgpt.site`.
If an earlier ChatGPT-Sites CNAME already exists for `payroll`, remove or replace
only that exact conflicting `payroll` record after confirming the new hosting
target. Do not change the main company website or its nameservers.

## Step 10 — Upload and configure the website

1. Open **cPanel → File Manager**.
2. Navigate to the subdomain's separate document root, such as
   `public_html/payroll`.
3. Upload the **contents** of `dist-supabase`, not the parent folder itself.
4. Confirm the resulting layout is:

   ```text
   public_html/payroll/index.html
   public_html/payroll/config.js
   public_html/payroll/assets/...
   ```

5. Right-click `config.js` and choose **Edit**.
6. Replace only the two placeholders:

   ```js
   window.JOY_PAYROLL_CONFIG = {
     supabaseUrl: "https://YOUR_REAL_PROJECT_REF.supabase.co",
     supabasePublishableKey: "YOUR_REAL_PUBLISHABLE_KEY",
     apiUrl: "",
   };
   ```

7. Save the file.

The URL and publishable key are designed to be visible in the browser. Secret
keys and service-role keys must never be inserted into this file.

## Step 11 — Enable HTTPS and sign in

1. Open **cPanel → SSL/TLS Status**.
2. Run **AutoSSL** for `payroll.joycorporatesolutions.com`, or ask your hosting
   provider to issue the certificate.
3. Wait until the certificate is active.
4. Visit:

   ```text
   https://payroll.joycorporatesolutions.com
   ```

5. Sign in using:

   ```text
   Email: praveen.red.07@gmail.com
   Password: the private password you created in Supabase Authentication
   ```

6. Confirm that **Users & Access**, **Clients & Employers**, **Employees**,
   **Attendance**, **Accommodation**, and **Payroll Run** are visible.

The new Supabase database begins empty, apart from the initial administrator.
Add your clients/employers and import your actual attendance or salary Excel
files. Existing ChatGPT-Site data is not silently transferred.

## Step 12 — Add Payroll Team and HR Team members

For each user:

1. In the payroll application, open **Users & Access → Add user**.
2. Enter their exact email and choose **Super Admin**, **Payroll Team**, or
   **HR Team**.
3. Set each module to **No access**, **View only**, or **Full access**.
4. Enable final payroll approval only for authorised approvers.
5. In Supabase, open **Authentication → Users → Add user**.
6. Invite the same email or create a confirmed password account for that email.
7. Give temporary credentials privately and require the user to change them.

Both records must exist: the Supabase Auth account verifies the person's identity,
and the application profile decides what payroll information they can access.

## Step 13 — Make future changes online

1. Open the private GitHub repository.
2. Start a GitHub Codespace in the browser.
3. Edit the source or ask your developer/AI coding assistant for the feature.
4. Test the change:

   ```bash
   npm test
   npm run test:supabase
   ```

5. For frontend or general application changes, rebuild:

   ```bash
   npm run build:supabase
   ```

6. Upload the new contents of `dist-supabase` to the existing payroll subdomain.
   Preserve your configured production `config.js`; do not overwrite it with the
   placeholder version unless you are intentionally updating those settings.
7. If the change affects payroll calculations, server permissions, API actions,
   or database-backed business rules, also redeploy:

   ```bash
   npm run prepare:supabase
   npx supabase@latest functions deploy payroll-api
   ```

8. If the feature adds new database tables or fields, run the reviewed new
   Supabase SQL migration before deploying the matching application version.

## Production safety checklist

- Keep the Supabase organisation and GitHub repository under Joy ownership.
- Require two-factor authentication for administrative accounts.
- Disable public user registration; invite only approved employees.
- Keep Row Level Security enabled on every payroll table.
- Never share passwords, database URLs with embedded credentials, service-role
  keys, secret keys, or personal access tokens in chat or GitHub.
- Back up the Supabase project before schema changes and payroll finalisation.
- Test one complete payroll month against the approved Excel register before
  real salary disbursement.
- Keep the existing ChatGPT-hosted application available until the independent
  installation passes your production checks.
