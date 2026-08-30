-- Room recovery is a dated transaction ledger. A room may have many recovery
-- entries inside the same payroll month; monthly finalization aggregates them.
DROP INDEX IF EXISTS public.accommodation_room_period_unique;

CREATE INDEX IF NOT EXISTS accommodation_room_period_idx
  ON public.accommodation_room_expenses (room_id, pay_period);
