# Recovery ledger hotfix

This hotfix makes individual recoveries and room recoveries auditable payroll inputs.

- Individual dated recoveries remain one transaction per entry and synchronize into accommodation charges and payroll totals.
- Approved payroll remains locked; the UI tells operators to reopen cleared payment batches first and then reopen payroll.
- Room recovery saves are append-only dated entries, not monthly overwrites.
- Finalizing a room/month aggregates all dated Gas, Ration and Provision entries, divides the monthly totals across confirmed occupants, and recalculates payroll.
- Reopening a room/month reopens the complete ledger and clears the prior shared payroll allocation before recalculation.
- Supabase migration removes the old unique room/month constraint and replaces it with a normal lookup index.
