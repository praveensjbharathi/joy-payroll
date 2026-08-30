# Joy Payroll Production Excellence Standard

This file defines the minimum release standard for the Joy Payroll application. A production release is not considered complete merely because it builds; the payroll, recovery, bank export, access-control and printed-document workflows must remain usable and internally consistent.

## Core employee and payroll acceptance

- Employee ID card is CR80 portrait (54 × 85.6 mm).
- Front of ID card shows employee identity, client employer and blood group; employee mobile is not printed on the front.
- Employee Master includes Highest Qualification.
- Employee payment method is bank transfer only. Cash is not a selectable production payment method.
- Payroll supports attendance-calculated and approved imported salary sources without bypassing validation.
- Wage flow remains understandable: attendance/source → earnings → statutory deductions → recoveries → final payable → bank validation → bank upload.
- Bank export options remain available for Indian Bank Excel, CUB Any Bank TXT and CUB-to-CUB TXT whenever the selected employee batch is bank-ready and the signed-in user has payment-export access.
- Missing bank account/IFSC data must block or clearly flag the affected employee rather than silently producing unsafe payment data.

## Recovery and voucher acceptance

- Recovery is salary-cycle and date-wise.
- Finalization is employee-specific and can be reopened only by an authorized approver.
- Bulk finalized voucher output is sourced from the finalization register itself so every finalized employee is included.
- Advance/final deduction vouchers show Joy company identity, client employer, Joy address, email/contact, salary cycle, employee identity and final payable.
- Printed vouchers use readable typography and one employee voucher per printed page in bulk mode.

## Hostel and accommodation acceptance

- Accommodation Type / Room Category is controlled from Operational Masters.
- Hostel/Area Master supports create, view, edit and delete where referential history permits deletion.
- Hostel/Area records support client-employer-unit mapping.
- The selected hostel/area shows mapped, room-unallocated eligible employees and allows authorized room allocation.
- Room-level shared expenses and recovery remain attributable to the correct payroll period and occupants.

## Role-specific standard

### Super Admin
Full system visibility and management, including access profiles, approval/finalization controls, clients, payroll, bank outputs, recoveries, hostel operations and settings.

### Payroll HR
Client-scoped payroll preparation, validation, recovery/payment workflow and bank/payslip outputs. User administration is not available by default.

### HR Manager
Employer-unit operational control for employee master, attendance, accommodation/hostel operations, masters and operational records. Bank disbursement is not available by default.

### Field HR
Employer/unit-scoped employee onboarding, attendance and accommodation operations. No bank disbursement or user administration by default.

### Hostel In-charge
Assigned-hostel residents and authorized hostel operational entries only; no payroll/bank/user administration.

## Release safety

- Pull requests to `main` run production requirement checks, application regression tests, Supabase type/deployment checks and the Cloudflare static build.
- Production Cloudflare deployment happens only from `main`.
- Supabase Edge Function deployment happens only from `main` and requires the configured GitHub deployment credential.
- The live Worker must not be switched to the Supabase-backed build until production data is reconciled and verified against the currently used live datastore.
