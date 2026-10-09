"""Role permissions, reconciliation and expiration with isolated mocked API responses."""
import os
import json
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("BASE_URL", "http://127.0.0.1:3100")
ACCOUNT = {"id": "10000000-0000-4000-8000-000000000001", "name": "Test account", "type": "BANK", "openingBalance": "100.00", "currentBalance": "99.99", "createdAt": "2026-10-01T00:00:00Z"}
DESTINATION = {"id": "10000000-0000-4000-8000-000000000002", "name": "Destination account", "type": "BANK", "openingBalance": "100.00", "currentBalance": "100.00", "createdAt": "2026-10-01T00:00:00Z"}

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for role in ["AUDITOR", "OPERATOR", "TREASURY_ADMIN"]:
        context = browser.new_context()
        context.add_cookies([{"name": "ledgerflow_access_token", "value": "mock-only", "url": BASE}])
        page = context.new_page()
        page.route("**/api/auth/session", lambda route: route.fulfill(json={"email": "mock@example.test", "role": role}))
        page.route("**/api/backend/accounts", lambda route: route.fulfill(json=[ACCOUNT]))
        page.goto(BASE + "/accounts")
        expect(page.get_by_text(role, exact=True)).to_be_visible()
        page.get_by_role("combobox", name="Data source").click()
        page.get_by_role("option", name="Local API").click()
        page.get_by_role("button", name="Continue to Local API").click()
        expect(page.locator("tbody")).to_contain_text("Test account")
        button = page.get_by_role("button", name="Create account", exact=True)
        (expect(button).to_be_disabled() if role != "TREASURY_ADMIN" else expect(button).to_be_enabled())
        page.get_by_role("link", name="Transfers", exact=True).click()
        review = page.get_by_role("button", name="Review transfer", exact=True)
        (expect(review).to_be_disabled() if role == "AUDITOR" else expect(review).to_be_enabled())
        page.get_by_role("link", name="Treasury", exact=True).click()
        allocation = page.get_by_role("button", name="Review allocation", exact=True)
        (expect(allocation).to_be_enabled() if role == "TREASURY_ADMIN" else expect(allocation).to_be_disabled())
        page.route("**/api/backend/reconciliation", lambda route: route.fulfill(json={
            "checkedAt": "2026-10-06T03:00:00Z", "status": "MISMATCH", "accountCount": 1,
            "mismatchedAccountCount": 1, "unbalancedTransferCount": 1,
            "accounts": [{"accountId": ACCOUNT["id"], "openingBalance": "100.00", "currentBalance": "99.99", "expectedBalance": "100.00", "difference": "-0.01", "status": "MISMATCH"}],
            "unbalancedTransfers": [{"transferId": "20000000-0000-4000-8000-000000000001", "debitTotal": "1.00", "creditTotal": "0.99", "difference": "0.01", "entryCount": 2}]
        }))
        page.get_by_role("link", name="Ledger", exact=True).click()
        expect(page.get_by_text("Not checked", exact=True)).to_be_visible()
        page.get_by_role("button", name="Check reconciliation", exact=True).click()
        panel = page.get_by_role("region", name="Ledger reconciliation")
        expect(panel).to_contain_text("MISMATCH")
        expect(panel).to_contain_text("−Rp 0,01")
        expect(panel).to_contain_text("Rp 1,00")
        # Failed recheck must not retain a previous success as a current check.
        page.route("**/api/backend/reconciliation", lambda route: route.fulfill(status=503, json={"message": "Mock unavailable"}))
        page.get_by_role("button", name="Check reconciliation", exact=True).click()
        expect(panel).to_contain_text("Mock unavailable")
        page.route("**/api/backend/accounts", lambda route: route.fulfill(status=401, json={"message": "Expired"}))
        page.get_by_role("link", name="Accounts", exact=True).click()
        page.get_by_role("button", name="Refresh accounts", exact=True).click()
        expect(page).to_have_url(BASE + "/auth/login")
        context.close()
    context = browser.new_context()
    context.add_cookies([{"name": "ledgerflow_access_token", "value": "mock-only", "url": BASE}])
    page = context.new_page()
    page.route("**/api/auth/session", lambda route: route.fulfill(json={"email": "mock@example.test", "role": "OPERATOR"}))
    page.route("**/api/backend/accounts", lambda route: route.fulfill(json=[ACCOUNT, DESTINATION]))
    submissions = []
    def submit_request(route):
        payload = route.request.post_data_json
        submissions.append(payload)
        route.fulfill(status=201, json={**payload, "id": "40000000-0000-4000-8000-000000000001", "status": "PENDING", "requesterId": "operator-user", "requesterEmail": "mock@example.test", "createdAt": "2026-10-09T03:00:00Z"})
    page.route("**/api/backend/transfer-requests", submit_request)
    saved = {"email": "mock@example.test", "sourceAccountId": ACCOUNT["id"], "targetAccountId": "10000000-0000-4000-8000-000000000002", "amount": "1.00", "description": "Uncertain payment", "idempotencyKey": "recover-original", "deposit": False}
    page.add_init_script("sessionStorage.setItem('ledgerflow-pending-request', " + json.dumps(json.dumps(saved)) + ")")
    page.goto(BASE + "/transfers")
    expect(page.get_by_text("OPERATOR", exact=True)).to_be_visible()
    expect(page.get_by_text("recover-original", exact=True)).to_be_visible()
    page.get_by_role("combobox", name="Data source").click()
    page.get_by_role("option", name="Local API").click()
    page.get_by_role("button", name="Continue to Local API").click()
    expect(page.get_by_role("button", name="Review transfer", exact=True)).to_be_disabled()
    page.get_by_role("button", name="Restore original request").click()
    expect(page.get_by_label("Amount in IDR")).to_have_value("1.00")
    expect(page.get_by_label("Amount in IDR")).to_be_disabled()
    expect(page.get_by_role("button", name="Retry unchanged request")).to_be_visible()
    page.get_by_role("button", name="Retry unchanged request").click()
    expect(page.get_by_role("heading", name="Approval requested", exact=True)).to_be_visible()
    expect(page.get_by_text("No account balance or journal entry has changed.")).to_be_visible()
    assert submissions == [{"sourceAccountId": ACCOUNT["id"], "targetAccountId": DESTINATION["id"], "amount": "1.00", "description": "Uncertain payment", "idempotencyKey": "recover-original"}]
    context.close()
    browser.close()
    print("PASS: live role controls, explicit reconciliation, signed differences, failed check, expired session")
