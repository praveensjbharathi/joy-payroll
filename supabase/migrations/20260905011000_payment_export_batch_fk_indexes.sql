-- Cover the individual export-batch foreign keys for efficient deletes and
-- referential checks. The first migration also declares these for fresh DBs;
-- this idempotent migration upgrades databases where it was already applied.

begin;

create index if not exists payment_export_batch_items_payroll_item_idx
  on public.payment_export_batch_items(payroll_item_id);
create index if not exists payment_export_batch_items_employee_fk_idx
  on public.payment_export_batch_items(employee_id);

commit;
