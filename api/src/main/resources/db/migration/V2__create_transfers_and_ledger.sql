CREATE TABLE transfers (
    id UUID PRIMARY KEY,
    source_account_id UUID NOT NULL REFERENCES accounts(id),
    target_account_id UUID NOT NULL REFERENCES accounts(id),
    amount NUMERIC(19, 2) NOT NULL,
    status VARCHAR(20) NOT NULL,
    idempotency_key VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_transfers_amount_positive
        CHECK (amount > 0),

    CONSTRAINT chk_transfers_different_accounts
        CHECK (source_account_id <> target_account_id),

    CONSTRAINT chk_transfers_status
        CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'REVERSED')),

    CONSTRAINT uq_transfers_idempotency_key
        UNIQUE (idempotency_key)
);

CREATE TABLE ledger_entries (
    id UUID PRIMARY KEY,
    transfer_id UUID NOT NULL REFERENCES transfers(id),
    account_id UUID NOT NULL REFERENCES accounts(id),
    direction VARCHAR(10) NOT NULL,
    amount NUMERIC(19, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_ledger_entries_direction
        CHECK (direction IN ('DEBIT', 'CREDIT')),

    CONSTRAINT chk_ledger_entries_amount_positive
        CHECK (amount > 0)
);

CREATE INDEX idx_transfers_source_account ON transfers(source_account_id);
CREATE INDEX idx_transfers_target_account ON transfers(target_account_id);
CREATE INDEX idx_ledger_entries_transfer_id ON ledger_entries(transfer_id);
CREATE INDEX idx_ledger_entries_account_id ON ledger_entries(account_id);