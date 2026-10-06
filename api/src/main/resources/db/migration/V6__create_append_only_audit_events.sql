CREATE TABLE audit_events (
    id UUID PRIMARY KEY,
    actor_id UUID,
    actor_email VARCHAR(320) NOT NULL,
    actor_role VARCHAR(30) NOT NULL,
    action VARCHAR(64) NOT NULL CHECK (action IN (
        'ACCOUNT_CREATED', 'TRANSFER_COMPLETED', 'TREASURY_DEPOSIT', 'TRANSFER_REVERSED'
    )),
    resource_id UUID NOT NULL,
    description VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT audit_events_actor_role_check
        CHECK (actor_role IN ('AUDITOR', 'OPERATOR', 'TREASURY_ADMIN', 'SYSTEM'))
);

CREATE INDEX idx_audit_events_created_at_id ON audit_events (created_at DESC, id DESC);
CREATE INDEX idx_audit_events_action_created_at ON audit_events (action, created_at DESC);
CREATE INDEX idx_audit_events_resource_created_at ON audit_events (resource_id, created_at DESC);

CREATE FUNCTION reject_audit_event_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'audit_events is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_events_reject_update_delete
    BEFORE UPDATE OR DELETE ON audit_events
    FOR EACH ROW EXECUTE FUNCTION reject_audit_event_mutation();

CREATE TRIGGER audit_events_reject_truncate
    BEFORE TRUNCATE ON audit_events
    FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_event_mutation();
