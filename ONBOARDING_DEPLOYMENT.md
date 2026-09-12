# Employee onboarding invitations

This change adds **Invite onboarding** beside **Add employee** in Employees → Employee Master. Existing row actions also open the invitation dialog. Super Admin and users with employee-management permission can invite employees within their assigned company/unit access.

## Deploy

1. Use this branch's source (or merge the pull request into main).
2. Deploy the new Supabase Edge Function **employee-onboarding** in project **fsiinadrkhsfzuheckbp**. The repository's `Deploy Joy Payroll API to Supabase` workflow now deploys it after payroll-api. It requires the existing `SUPABASE_ACCESS_TOKEN` GitHub Actions secret.
3. If deploying through the CLI, run from the repository root:

   ```sh
   supabase functions deploy employee-onboarding --project-ref fsiinadrkhsfzuheckbp --use-api
   ```

   The committed `supabase/config.toml` disables the gateway JWT check for this function only. The function itself requires either a verified HR session with employee-management scope or a valid one-time invitation token. Do not enable gateway JWT verification for this function: applicants do not have HR accounts.
4. The function reuses the existing Edge Function secrets `JOY_SMTP_HOST`, `JOY_SMTP_PORT`, `JOY_SMTP_USER`, and `JOY_SMTP_PASSWORD`. The password must be available as an Edge Function secret; Supabase Auth SMTP settings alone are not accessible to an Edge Function. Do not add these values to GitHub source or browser config.
5. Build Cloudflare frontend with `npm ci` and `npm run build:supabase`. Deploy using the existing `wrangler.jsonc` configuration / Cloudflare build integration. The output is `dist-supabase`.
6. Reload the application and select the employee's company and unit. Open **Employees → Invite onboarding**, select an active employee, and click **Send email invitation**.

Both backend and frontend updates are needed. Deploying only Cloudflare will show the controls but cannot enable the new email endpoint. Existing main-branch workflows trigger deployments on push/merge; this change is supplied on a separate branch to leave manual deployment under your control.

## Behavior

- Email is sent server-side to the address stored in Employee Master. The UI confirms only after SMTP accepts the recipient; inbox delivery still depends on the email provider.
- Create sharing link enables Copy link, SMS, WhatsApp and Mobile share. SMS/WhatsApp open the user's messaging app; they are not paid server messaging integrations.
- Invitations expire after seven days, can be submitted once, and are replaced when HR creates a new invitation. Reissuing is limited to once per minute per employee.
- Applicant links open a mobile-friendly application questionnaire without an HR login. Old employee-code-only links show a request for a new invitation.
- Submitted answers appear in the existing Company e-Job Application fields in Employee Master. Refresh/reopen the employee record to review them. Applicants upload PDF, PNG and JPEG documents directly with their invitation: Aadhaar front/back, bank proof, five education certificates, three employment proofs and two other proofs. Limits are 4 MB per file and 18 MB per submission. HR can download the files during review and they carry into Employee Master when HR saves the reviewed applicant.
- Tokens are random, stored only as hashes, and carried in URL fragments. Applicants receive only their name and expiry; existing salary, banking and application data are not returned. Only questionnaire fields can be submitted. No payroll values are changed.
- Invitation state uses a reserved object inside existing `application_json`; no migration is required. HR saving/replacing that application may invalidate a pending link, in which case issue a new one. Conditional updates prevent replays and overwriting concurrent application edits.

## Verification

- `npm run build:supabase` passed.
- `npx tsc --project tsconfig.supabase.json --noEmit` passed after the API generation step.
- `node --experimental-strip-types --test tests/employee-onboarding*.test.mjs` passed seven tests, including endpoint calls with mocked SMTP and database access.
- No real employee emails were sent and no production database was changed during these checks.

## September 12 onboarding and reporting update

- Read, Write and Speak checkboxes for each language, plus Add language.
- Caste, religion and community/category are not collected by onboarding.
- Colour-coded input sections with readable 16 px controls.
- Fresher hides employment history; qualification controls education sections; marital status and family counts control spouse, children and siblings. Empty optional answers are excluded from the application PDF.
- Reference 1 requires an active Joy direct employee, stored by ID with a server-validated employee code and name. Reference 2 accepts typed name, position, address and phone.
- Reports contains separate Reference 1 and Reference 2 detail/summary reports with CSV, Excel and PDF print options. Bonus estimates use the selected payroll's worked days and an administrator-entered threshold and rate; they do not post bonus payments.
- Reports also contains the Super Admin revenue calculator. The API checks the role and loads earned gross salary/payable days directly from the selected payroll. Service charge, billed employer contributions, other billing, operating cost, referral bonus and GST are explicit assumptions. GST is excluded from contribution.
- Migration `20260912170909_onboarding_documents_references.sql` was applied in the production Supabase project. Existing employee submissions and attachments use a service-role-only transaction; new applicant attachments remain in the private invitation record until HR review.
- Setup requirement: add or correctly classify the company's active direct employees before requiring applicants to choose Reference 1. No employee is automatically reclassified.
- Verification: 17 targeted onboarding/reference/revenue tests; 23 existing production/deployment contract tests; TypeScript and frontend production build. Database tests confirmed attachment/answer rollback, replay rejection and denied direct anonymous access, with dummy rows rolled back. Local interactive browser preview was blocked by the browser environment.
