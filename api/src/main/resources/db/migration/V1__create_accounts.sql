CREATE TABLE accounts (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL,
    opening_balance NUMERIC(19, 2) NOT NULL,
    current_balance NUMERIC(19, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_accounts_name_not_blank
        CHECK (length(trim(name)) > 0),

    CONSTRAINT chk_accounts_type
        CHECK (type IN ('CASH', 'BANK', 'EWALLET')),

    CONSTRAINT chk_accounts_balance_non_negative
        CHECK (opening_balance >= 0 AND current_balance >= 0)
);