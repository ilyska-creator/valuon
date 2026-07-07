-- Add Ed25519 cryptographic key columns to shops table
-- This migration adds support for digital signatures on fiscal receipts

-- Add public_key column (for signature verification)
ALTER TABLE shops 
ADD COLUMN IF NOT EXISTS public_key TEXT;

-- Add private_key column (for signature creation)
ALTER TABLE shops 
ADD COLUMN IF NOT EXISTS private_key TEXT;

-- Add index on public_key for faster verification lookups
CREATE INDEX IF NOT EXISTS idx_shops_public_key ON shops(public_key);

-- Add comment to document the purpose
COMMENT ON COLUMN shops.public_key IS 'Ed25519 public key for verifying fiscal receipt signatures';
COMMENT ON COLUMN shops.private_key IS 'Ed25519 private key for signing fiscal receipts (store securely)';
