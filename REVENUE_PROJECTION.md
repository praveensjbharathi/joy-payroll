# Revenue Projection

Open **Revenue Projection** in the main menu as Super Admin. The existing Reports → Revenue calculator still estimates billing for a selected payroll run; this page calculates calendar-month actuals and forecasts from daily attendance.

## Start each month

1. Choose the calendar month and overall, group-company, client or unit scope.
2. Open **Monthly client setup**, select each client unit, and review its calendar.
3. Use **All days working** for continuous operation, or **Sundays off** as a starting point. Mark government holidays by date and name. For each date choose whether the client operates and, if closed, whether that day is paid.
4. Review the monthly salary divisor, standard hours, OT rate and multiplier, holiday-work multiplier, paid leave, billed employer costs and service charge. Calendar operating days and the salary divisor are separate settings.
5. Enter a unit target and any explicit fallback salary/attendance/OT assumptions. Previous-month rates can be copied; dates, holidays and targets must be reviewed for the new month.
6. Tick the monthly review declaration and **Save & confirm this month**. Saving a draft or editing a confirmed setup requires confirmation again. Other sessions cannot overwrite a newer revision silently.

Forecasts require confirmed setups for all clients in the selected scope. Missing employee salary rates require correction in Employee Master or an explicit monthly fallback rate. No calendars, holiday dates or commercial rates are automatically confirmed on deployment.

## Calculation definitions

- Actuals use recorded attendance through the selected cutoff, at the current employee salary rate and confirmed monthly billing rules. P/HP count as one worked day and HD as half a day. Paid leave, weekly offs and holidays follow the monthly rules; recorded work on closed days is retained and flagged.
- Monthly salary is divided by the configured salary divisor; daily salary is used directly. Base OT rate is the configured hourly rate, or daily salary divided by standard hours, multiplied by the configured OT multiplier. Holiday work can have its own wage multiplier.
- Employer costs are the entered percentage of earned wages including OT. Service charge applies to wages or wages plus employer costs. Other billing and operating costs are per employee payable day.
- Revenue excludes GST: earned wages + billed employer costs + service charge + other billing. Contribution subtracts earned wages, billed employer costs and configured operating costs. These estimates do not create invoices, payroll payments, bonus payments or recruitment records.
- Pending past attendance is estimated separately. Upcoming days use the client's calendar, employees' joining/leaving dates, and attendance/OT patterns from recorded working-day entries in the preceding 28 days. The history source and sample size are shown. When there is no usable history, the explicitly confirmed monthly assumptions apply.
- Full month = recorded actuals + pending attendance estimate + upcoming-day forecast. Forecasts retain fractional expected attendance. Missing entries are never silently marked absent or promoted to actuals.
- Client-deployed employees contribute to revenue. Joy direct employees are excluded. Leavers' recorded historical work remains included; their availability is limited by employment dates. Inactive employees without leaving dates contribute recorded actuals only.

## Recruitment planning

Both directions preserve existing actuals and the current workforce forecast. Choose the client unit receiving the new recruits and a joining date after the actuals cutoff.

- **Revenue → manpower:** the revenue gap divided by one recruit's expected remaining-month revenue, rounded up to whole employees.
- **Manpower → revenue:** additional recruits, or the desired total manpower in the selected scope, converted into additional revenue using the same remaining-month calculation.

New recruitment is assigned to the explicitly selected deployment unit. Company and overall forecasts sum individual client calculations. Rates are not blended across unrelated clients. Automatic recruitment reports use each unit's saved target and earliest upcoming joining date. Closed months, missing rates, zero payable days and unattainable targets produce explanatory results rather than infinite or negative headcounts.

CSV, genuine XLSX and Print / Save PDF reports contain scope, cutoff, actual/pending/future figures, daily attendance and OT, company/client totals, recruitment results and the calendar and rate assumptions. The forecast view refreshes every minute while visible; use **Refresh live data** for an immediate update.

## Security and deployment

All three revenue API actions require the active authenticated profile to be `super_admin`, independent of configurable module permissions. Monthly plans are not included in the general app-data response. `public.revenue_month_plans` has RLS enabled and no `anon` or `authenticated` table grants; the payroll API performs authorized reads and writes. Calendar changes are audited and protected by revision checks.

Migration: `supabase/migrations/20260913035033_revenue_month_plans.sql`. Apply before deploying the API. `scripts/build-supabase-api.mjs` copies the pure projection engine into the Supabase function. GitHub workflows verify the calculation, report and access regressions and deploy the API and Cloudflare frontend.

Validation covers calendar lengths/leap years, Sunday and holiday operation, actual/pending/future separation, half days and OT, joining/leaving dates, missing rates, different client rates, salary divisors, both calculator directions, unattainable targets, reports and non-admin denial. Live database checks use a rolled-back transaction to verify persistence, uniqueness, stale revision protection and denied authenticated access.
