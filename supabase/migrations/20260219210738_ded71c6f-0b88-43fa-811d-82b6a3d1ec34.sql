
-- Drop the unique constraint on phone to allow multiple leads with the same phone number
-- This is required for the "always insert new lead" strategy
-- Rollback: ALTER TABLE leads ADD CONSTRAINT leads_phone_unique UNIQUE (phone);

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_phone_unique;

-- Add an index for phone lookups (non-unique) for performance
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads (phone);
