"""Mocked live account status controls; real financial guards are covered by API tests."""
import os
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("BASE_URL", "http://127.0.0.1:3200")
ID = "10000000-0000-4000-8000-000000000001"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for role in ["AUDITOR", "OPERATOR", "TREASURY_ADMIN"]:
        context = browser.new_context()
        context.add_cookies([{"name": "ledgerflow_access_token", "value": "mock", "url": BASE}])
        page = context.new_page()
        state = {"frozen": False, "calls": []}
        def backend(route):
            path = route.request.url.split("/api/backend/")[-1]
            account = {"id": ID, "name": "Review account", "type": "BANK", "openingBalance": "100.00", "currentBalance": "100.00", "createdAt": "2026-10-01T00:00:00Z", "frozen": state["frozen"]}
            if path == "accounts":
                return route.fulfill(json=[account])
            if path in [f"accounts/{ID}/freeze", f"accounts/{ID}/unfreeze"]:
                assert role == "TREASURY_ADMIN"
                state["calls"].append(route.request.post_data_json)
                state["frozen"] = path.endswith("/freeze")
                account["frozen"] = state["frozen"]
                return route.fulfill(json=account)
            return route.fulfill(status=404, json={"message": "Unexpected mock request"})
        page.route("**/api/auth/session", lambda route: route.fulfill(json={"email": "mock@example.test", "role": role}))
        page.route("**/api/backend/**", backend)
        page.goto(BASE + "/accounts")
        page.get_by_role("combobox", name="Data source").click()
        page.get_by_role("option", name="Local API").click()
        page.get_by_role("button", name="Continue to Local API").click()
        expect(page.locator("tbody")).to_contain_text("Active")
        page.get_by_role("button", name="Actions for Review account").click()
        if role != "TREASURY_ADMIN":
            expect(page.get_by_role("menuitem", name="Freeze account", exact=True)).to_have_count(0)
            assert not state["calls"]
        else:
            page.get_by_role("menuitem", name="Freeze account", exact=True).click()
            dialog = page.get_by_role("dialog", name="Freeze account", exact=True)
            expect(dialog.get_by_role("button", name="Confirm freeze")).to_be_disabled()
            dialog.get_by_label("Reason for status change").fill("Review activity")
            dialog.get_by_role("button", name="Confirm freeze").click()
            expect(page.locator("tbody")).to_contain_text("Frozen")
            page.get_by_role("button", name="Actions for Review account").click()
            expect(page.get_by_role("menuitem", name="Transfer funds")).to_be_disabled()
            expect(page.get_by_role("menuitem", name="Allocate from treasury")).to_be_disabled()
            page.get_by_role("menuitem", name="Unfreeze account", exact=True).click()
            dialog = page.get_by_role("dialog", name="Unfreeze account", exact=True)
            dialog.get_by_label("Reason for status change").fill("Review complete")
            dialog.get_by_role("button", name="Confirm unfreeze").click()
            expect(page.locator("tbody")).to_contain_text("Active")
            assert state["calls"] == [{"reason": "Review activity"}, {"reason": "Review complete"}]
        context.close()
    browser.close()
    print("PASS: frozen status, admin confirmation/reason, read-only roles, freeze/unfreeze refresh")
