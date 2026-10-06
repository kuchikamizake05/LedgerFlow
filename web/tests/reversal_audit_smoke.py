"""Browser checks for live-mode audit browsing and role-gated reversals."""
import json
import os
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("BASE_URL", "http://127.0.0.1:3102")
ACCOUNT_ID = "10000000-0000-4000-8000-000000000001"
TRANSFER_ID = "20000000-0000-4000-8000-000000000001"
REVERSAL_ID = "20000000-0000-4000-8000-000000000099"
ACCOUNT = {"id": ACCOUNT_ID, "name": "Test account", "type": "BANK", "openingBalance": "100.00", "currentBalance": "99.00", "createdAt": "2026-10-01T00:00:00Z"}
ENTRIES = [
    {"id": "30000000-0000-4000-8000-000000000001", "transferId": TRANSFER_ID, "accountId": ACCOUNT_ID, "direction": "DEBIT", "amount": "1.00", "createdAt": "2026-10-01T00:00:00Z"},
    {"id": "30000000-0000-4000-8000-000000000002", "transferId": TRANSFER_ID, "accountId": ACCOUNT_ID, "direction": "CREDIT", "amount": "1.00", "createdAt": "2026-10-01T00:00:00Z"},
]


def setup_role(browser, role):
    context = browser.new_context()
    context.add_cookies([{"name": "ledgerflow_access_token", "value": "mock-only", "url": BASE}])
    page = context.new_page()
    state = {"transfer_status": "COMPLETED", "reversal_calls": [], "statement_calls": 0, "account_calls": 0, "audit_urls": []}

    def backend(route):
        request = route.request
        url = request.url
        path = url.split("/api/backend/", 1)[-1]
        if path == "accounts":
            state["account_calls"] += 1
            return route.fulfill(json=[ACCOUNT])
        if path.startswith("accounts/") and "/statement" in path:
            state["statement_calls"] += 1
            return route.fulfill(json={"content": ENTRIES, "page": 0, "size": 15, "totalElements": 2, "totalPages": 1, "hasNext": False})
        if path == "audit" or path.startswith("audit?"):
            state["audit_urls"].append(url)
            return route.fulfill(json={"content": [{"id": "40000000-0000-4000-8000-000000000001", "actorId": None, "actorEmail": "admin@example.test", "actorRole": "TREASURY_ADMIN", "action": "TRANSFER_REVERSED", "resourceId": TRANSFER_ID, "description": "Reversed duplicate", "createdAt": "2026-10-06T00:00:00Z"}], "page": 0, "size": 20, "totalElements": 1, "totalPages": 1, "hasNext": False})
        if path == f"transfers/{TRANSFER_ID}/entries":
            return route.fulfill(json=ENTRIES)
        if path == f"transfers/{TRANSFER_ID}":
            return route.fulfill(json={"id": TRANSFER_ID, "sourceAccountId": ACCOUNT_ID, "targetAccountId": ACCOUNT_ID, "amount": "1.00", "status": state["transfer_status"], "idempotencyKey": "original-reference", "description": "Original transfer", "createdAt": "2026-10-01T00:00:00Z", "reversalOf": None})
        if path == f"transfers/{TRANSFER_ID}/reversal" and request.method == "POST":
            state["reversal_calls"].append(json.loads(request.post_data or "{}"))
            if len(state["reversal_calls"]) == 1:
                return route.fulfill(status=503, json={"message": "Confirmation unavailable"})
            state["transfer_status"] = "REVERSED"
            return route.fulfill(json={"id": REVERSAL_ID, "sourceAccountId": ACCOUNT_ID, "targetAccountId": ACCOUNT_ID, "amount": "1.00", "status": "COMPLETED", "idempotencyKey": "reversal-reference", "description": "Reversal", "createdAt": "2026-10-06T00:00:00Z", "reversalOf": TRANSFER_ID})
        return route.fulfill(status=404, json={"message": f"Unexpected mock request: {path}"})

    page.route("**/api/auth/session", lambda route: route.fulfill(json={"email": "mock@example.test", "role": role}))
    page.route("**/api/backend/**", backend)
    return context, page, state


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for role in ["OPERATOR", "TREASURY_ADMIN"]:
        context, page, state = setup_role(browser, role)
        page.goto(BASE + "/audit")
        page.get_by_role("combobox", name="Data source").click()
        page.get_by_role("option", name="Local API").click()
        page.get_by_role("button", name="Continue to Local API").click()
        expect(page.get_by_role("heading", name="Audit trail")).to_be_visible()
        expect(page.locator("tbody")).to_contain_text("TRANSFER_REVERSED")
        page.get_by_label("Filter by exact action").fill("TRANSFER_REVERSED")
        with page.expect_response(lambda response: "/audit?" in response.url and "action=TRANSFER_REVERSED" in response.url and "resourceId=" in response.url):
            page.get_by_label("Filter by exact resource ID").fill(TRANSFER_ID)
        assert "resourceId=" in state["audit_urls"][-1]

        page.goto(BASE + f"/ledger?account={ACCOUNT_ID}")
        page.get_by_role("combobox", name="Data source").click()
        page.get_by_role("option", name="Local API").click()
        page.get_by_role("button", name="Continue to Local API").click()
        page.wait_for_load_state("networkidle")
        expect(page.locator("tbody")).to_contain_text("Rp 1,00")
        page.locator("tbody tr").first.locator("button.link").click()
        drawer = page.get_by_role("dialog", name="Transaction details")
        expect(drawer).to_contain_text("Original transfer")
        if role == "OPERATOR":
            expect(drawer.get_by_label("Reason for reversal")).to_have_count(0)
            expect(drawer.get_by_role("button", name="Confirm reversal")).to_have_count(0)
            expect(drawer).to_contain_text("restricted to Treasury Admin")
            assert not state["reversal_calls"]
        else:
            reason = drawer.get_by_label("Reason for reversal")
            confirm = drawer.get_by_role("button", name="Confirm reversal")
            expect(confirm).to_be_disabled()
            reason.fill("   ")
            expect(confirm).to_be_disabled()
            reason.fill("Duplicate payment")
            expect(confirm).to_be_enabled()
            page.evaluate("() => { window.originalStorageSet = Storage.prototype.setItem; Storage.prototype.setItem = () => { throw new Error('Storage blocked'); }; }")
            confirm.click()
            expect(drawer).to_contain_text("Reversal was not submitted")
            assert not state["reversal_calls"]
            page.evaluate("() => { Storage.prototype.setItem = window.originalStorageSet; }")
            other_key = "ledgerflow-pending-reversal:mock@example.test:other-transfer"
            page.evaluate("key => localStorage.setItem(key, 'unresolved-other-request')", other_key)
            confirm.click()
            expect(drawer).to_contain_text("The result is unconfirmed")
            first_request = state["reversal_calls"][0].copy()
            page.reload()
            page.get_by_role("combobox", name="Data source").click()
            page.get_by_role("option", name="Local API").click()
            page.get_by_role("button", name="Continue to Local API").click()
            page.wait_for_load_state("networkidle")
            page.locator("tbody tr").first.locator("button.link").click()
            drawer = page.get_by_role("dialog", name="Transaction details")
            expect(drawer.get_by_label("Reason for reversal")).to_have_value("Duplicate payment")
            expect(drawer.get_by_label("Reason for reversal")).to_be_disabled()
            confirm = drawer.get_by_role("button", name="Retry same reversal")
            before_statements = state["statement_calls"]
            before_accounts = state["account_calls"]
            with page.expect_response(lambda response: response.url.endswith("/api/backend/accounts")):
                confirm.click()
            expect(drawer).to_contain_text("REVERSED")
            page.wait_for_load_state("networkidle")
            assert len(state["reversal_calls"]) == 2
            assert state["reversal_calls"][1] == first_request
            assert page.evaluate("key => localStorage.getItem(key)", other_key) == "unresolved-other-request"
            assert state["reversal_calls"][0]["reason"] == "Duplicate payment"
            assert state["reversal_calls"][0]["idempotencyKey"]
            assert state["account_calls"] > before_accounts
            assert state["statement_calls"] > before_statements
        context.close()
    browser.close()
    print("PASS: audit filters, operator read-only view, required reversal reason, post-reversal refresh")
