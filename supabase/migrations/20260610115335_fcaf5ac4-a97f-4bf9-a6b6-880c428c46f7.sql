ALTER TABLE public.contracts 
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID,
  ADD COLUMN IF NOT EXISTS process_completed BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_contracts_archived_at ON public.contracts(archived_at);