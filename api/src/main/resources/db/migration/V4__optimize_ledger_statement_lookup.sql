-- Statement selalu memfilter account_id lalu mengurutkan transaksi terbaru.
-- Composite index ini menghindari scan besar dan sort tambahan ketika ledger membesar.
DROP INDEX IF EXISTS idx_ledger_entries_account_id;

CREATE INDEX idx_ledger_entries_account_created_at
    ON ledger_entries(account_id, created_at DESC);
