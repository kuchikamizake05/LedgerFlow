INSERT INTO accounts (id, name, type, opening_balance, current_balance, created_at)
VALUES ('00000000-0000-0000-0000-000000000001', 'System Treasury', 'BANK', 1000000000.00,
1000000000.00, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;