CREATE TABLE transfer_requests (
    id UUID PRIMARY KEY,
    source_account_id UUID NOT NULL REFERENCES accounts(id),
    target_account_id UUID NOT NULL REFERENCES accounts(id),
    amount NUMERIC(19, 2) NOT NULL,
    idempotency_key VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    requester_id UUID NOT NULL,
    requester_email VARCHAR(320) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    decision_actor_id UUID,
    decision_actor_email VARCHAR(320),
    decision_reason VARCHAR(255),
    decided_at TIMESTAMPTZ,
    completed_transfer_id UUID REFERENCES transfers(id),

    CONSTRAINT chk_transfer_requests_amount_positive CHECK (amount > 0),
    CONSTRAINT chk_transfer_requests_different_accounts CHECK (source_account_id <> target_account_id),
    CONSTRAINT chk_transfer_requests_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    CONSTRAINT uq_transfer_requests_idempotency_key UNIQUE (idempotency_key),
    CONSTRAINT chk_transfer_requests_decision_state CHECK (
        (status = 'PENDING' AND decision_actor_id IS NULL AND decision_actor_email IS NULL
            AND decision_reason IS NULL AND decided_at IS NULL AND completed_transfer_id IS NULL)
        OR (status = 'APPROVED' AND decision_actor_id IS NOT NULL AND decision_actor_email IS NOT NULL
            AND decision_reason IS NOT NULL AND decided_at IS NOT NULL AND completed_transfer_id IS NOT NULL)
        OR (status = 'REJECTED' AND decision_actor_id IS NOT NULL AND decision_actor_email IS NOT NULL
            AND decision_reason IS NOT NULL AND decided_at IS NOT NULL AND completed_transfer_id IS NULL)
    )
);

CREATE INDEX idx_transfer_requests_created_at_id ON transfer_requests (created_at DESC, id DESC);
CREATE INDEX idx_transfer_requests_status_created_at ON transfer_requests (status, created_at DESC, id DESC);

ALTER TABLE audit_events DROP CONSTRAINT audit_events_action_check;
ALTER TABLE audit_events ADD CONSTRAINT audit_events_action_check CHECK (action IN (
    'ACCOUNT_CREATED', 'ACCOUNT_FROZEN', 'ACCOUNT_UNFROZEN',
    'TRANSFER_COMPLETED', 'TREASURY_DEPOSIT', 'TRANSFER_REVERSED',
    'TRANSFER_REQUESTED', 'TRANSFER_APPROVED', 'TRANSFER_REJECTED'
));
