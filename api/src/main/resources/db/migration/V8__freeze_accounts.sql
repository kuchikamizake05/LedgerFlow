ALTER TABLE accounts
    ADD COLUMN frozen BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE audit_events
    DROP CONSTRAINT audit_events_action_check;

ALTER TABLE audit_events
    ADD CONSTRAINT audit_events_action_check
    CHECK (action IN (
        'ACCOUNT_CREATED', 'ACCOUNT_FROZEN', 'ACCOUNT_UNFROZEN',
        'TRANSFER_COMPLETED', 'TREASURY_DEPOSIT', 'TRANSFER_REVERSED'
    ));
