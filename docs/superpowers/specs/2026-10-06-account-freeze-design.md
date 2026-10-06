# Dependency cleanup and account freezing

The user approved minimal vulnerability cleanup followed by admin account freeze/unfreeze.

Remove unused runtime tooling or apply narrow compatible dependency fixes after inspecting advisory chains. Preserve framework compatibility and report unresolved findings.

Accounts gain a frozen flag, initially false. Admin-only POST /api/accounts/{id}/freeze and /unfreeze accept a required reason up to 255 characters. Account locks serialize status changes with financial movements. Changing state records ACCOUNT_FROZEN or ACCOUNT_UNFROZEN in the same transaction; repeating the desired state returns the account without another event. The system treasury cannot be frozen.

New transfers, deposits and reversals reject either frozen endpoint with 409 before balance or journal mutation. An exact replay of an already committed operation remains readable even if an account was subsequently frozen. Read access and reconciliation remain available.

The live Accounts screen shows account status and admin confirmation with required reason. Other roles read status. Demo mode does not claim persistent freeze behavior. Preserve existing ledger and audit workflows. No remote deployment or push is included.
