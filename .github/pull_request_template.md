## Business result

Explain what changed and which Joy Payroll users benefit.

## Access and data safety

- [ ] Server-side module permissions were checked.
- [ ] Salary, bank, statutory, accommodation, and user data remain filtered.
- [ ] Approved payroll cannot be changed without reopening.
- [ ] No real employee data, secrets, exports, or backups were committed.

## Database and calculations

- [ ] No schema change was needed, or a new reviewed Drizzle migration is included.
- [ ] Calculation, rounding, effective-date, and arrears behavior was verified.
- [ ] Relevant audit events are recorded.

## Verification

- [ ] `npm test`
- [ ] `npm run test:self-hosted-auth`
- [ ] Main workflow checked with synthetic data.
