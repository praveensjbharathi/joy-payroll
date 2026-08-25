# Joy Client Payroll Manager development rules

This is a confidential multi-client payroll application for Joy Corporate Solutions Private Limited. Preserve the existing Joy design, plain-language labels, and role-based workflow.

## Product rules that must not be broken

- Use **Client** in user-facing text. Historical database names such as `vendors` may remain until a planned migration.
- Enforce permissions in `app/api/app-data/route.ts`; hiding a button in the browser is not authorization.
- Never expose salary, bank, statutory, accommodation, or user-access data to a role without server-side View access.
- Approved payroll is immutable. A permitted user must explicitly reopen it before attendance, salary, deduction, or employee-linked data can change.
- Preserve audit events for material changes and approvals.
- Never commit real employee data, passwords, API tokens, bank files, payroll exports, or database backups.
- Keep the ChatGPT Sites authentication path and the self-hosted Cloudflare Access path working.
- Verify Cloudflare Access JWT signature, issuer, audience, expiry, and email before trusting identity.

## Main source locations

- `app/payroll-app.tsx`: screens, forms, tables, and interactions
- `app/api/app-data/route.ts`: API, validations, permissions, and database actions
- `app/auth.ts`: dual-host authentication adapter
- `lib/access-control.ts`: roles and module permissions
- `lib/payroll-calculations.ts`: payroll calculations
- `lib/excel-import.ts`: Excel and CSV import mapping
- `db/schema.ts`: database schema
- `drizzle/`: ordered database migrations
- `tests/`: workflow, import, rendering, and authentication checks

## Safe feature-change process

1. State the affected roles, modules, fields, calculations, exports, and audit behavior.
2. Reuse existing patterns before adding a new dependency or table.
3. For a schema change, update `db/schema.ts`, generate and inspect a new migration, and do not edit old applied migrations.
4. Add or update tests for server authorization and calculations.
5. Run `npm test` and `npm run test:self-hosted-auth` before merging.
6. Use synthetic data only in tests and examples.
