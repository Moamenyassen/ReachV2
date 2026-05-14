-- Optional migration: adds a human-readable ticket number to license requests
-- Run this once in your Supabase SQL editor if you want proper ticket numbers
-- instead of the user-ID-derived fallback shown in PendingLicenseScreen.

-- 1. Add the column
ALTER TABLE public.reach_license_requests
ADD COLUMN IF NOT EXISTS ticket_number TEXT UNIQUE;

-- 2. Auto-generate ticket on insert via trigger
CREATE OR REPLACE FUNCTION generate_license_ticket()
RETURNS TRIGGER AS $$
BEGIN
  NEW.ticket_number := 'RCH-' || UPPER(SUBSTRING(REPLACE(NEW.id::text, '-', ''), 1, 8));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_license_ticket ON public.reach_license_requests;
CREATE TRIGGER trg_license_ticket
  BEFORE INSERT ON public.reach_license_requests
  FOR EACH ROW EXECUTE FUNCTION generate_license_ticket();

-- 3. Backfill existing rows
UPDATE public.reach_license_requests
SET ticket_number = 'RCH-' || UPPER(SUBSTRING(REPLACE(id::text, '-', ''), 1, 8))
WHERE ticket_number IS NULL;
