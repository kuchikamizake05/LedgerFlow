# Transfer approval

User approved mandatory approval for every ordinary transfer. Deposits and reversals retain their admin workflows.

Use a separate transfer_requests table, preserving completed transfer/journal schemas. POST /api/transfer-requests accepts the existing transfer payload, allowed to OPERATOR and TREASURY_ADMIN. Pending requests reserve no funds. Persist authenticated requester UUID/email, immutable payload, key, status PENDING, decision actor/reason/time and completedTransferId. GET list/detail is readable to all roles, with paginated status filtering. Existing POST /api/transfers must reject direct execution with 409; internal movement helpers remain available only through authorized approval and admin deposits.

Admin POST /api/transfer-requests/{id}/approve or /reject requires nonblank reason <=255. The requester cannot decide their own request. Lock request then accounts in deterministic order. Approval revalidates amount, ordinary source, existence, freeze state, funds and overflow and atomically posts a completed transfer, journal, APPROVED state and audit. Failed approval remains PENDING. Rejection records REJECTED and audit with no financial mutation.

Submission keys are globally reserved across requests and executed transfers. Same requester/key/unchanged payload replays; other requester or changed payload conflicts. Decision retries with same actor/action/reason return the existing state without additional movement/event; opposite action or changed decision conflicts. Concurrent decisions post at most once. No historical pending data or invented actors.

UI changes live ordinary transfer submission to an approval request and adds an Approvals page for queue/details/decisions. Show pending clearly, never a completed-payment receipt. Admin controls exclude own requests; backend is authoritative. Demo shows truthful synthetic/nonpersisted behavior. Unknown submission confirmation retains unchanged key and payload. Verify roles, self-approval, retries/concurrency, freeze/balance recheck, audits, direct bypass rejection and browser workflows. No push/deploy included.
