ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS application_json text;
COMMENT ON COLUMN public.employees.application_json IS 'Optional e-Job application details, protected by existing employee access controls. Missing payloads preserve existing values.';
