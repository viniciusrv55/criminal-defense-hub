ALTER TABLE public.installment_renegotiations
  ADD COLUMN IF NOT EXISTS payment_key_map jsonb,
  ADD COLUMN IF NOT EXISTS reverted_at timestamptz;