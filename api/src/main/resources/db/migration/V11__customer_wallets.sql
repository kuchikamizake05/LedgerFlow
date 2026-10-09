ALTER TABLE accounts ADD COLUMN owner_user_id UUID NULL REFERENCES app_users(id);
CREATE UNIQUE INDEX uq_accounts_owner_user_id ON accounts(owner_user_id) WHERE owner_user_id IS NOT NULL;
