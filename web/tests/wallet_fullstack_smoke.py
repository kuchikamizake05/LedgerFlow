"""Wallet browser flow against a real, disposable API database.

Requires simulator topups enabled, Python Playwright/Chromium, and optionally
WALLET_SMOKE_ADMIN_EMAIL/PASSWORD to verify internal ledger/reconciliation.
All created identities and financial movements are simulated test data.
"""
import json
import os
from pathlib import Path
from uuid import uuid4

from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get("BASE_URL", "http://127.0.0.1:3200")
API = os.environ.get("WALLET_SMOKE_API_URL", "http://127.0.0.1:8082")
ARTIFACTS = Path(__file__).parent / "artifacts"
ARTIFACTS.mkdir(exist_ok=True)


def register_and_login(page, email, password):
    page.goto(BASE + "/wallet/register", wait_until="networkidle")
    page.get_by_label("Email address").fill(email)
    page.get_by_label("Password", exact=True).fill(password)
    page.get_by_label("Confirm password").fill(password)
    page.get_by_role("button", name="Create wallet", exact=True).click()
    expect(page.get_by_role("heading", name="Wallet created")).to_be_visible()
    page.get_by_role("link", name="Continue to sign in").click()
    page.get_by_label("Email address").fill(email)
    page.get_by_label("Password", exact=True).fill(password)
    page.get_by_role("button", name="Sign in", exact=True).click()
    expect(page).to_have_url(BASE + "/wallet")
    expect(page.locator(".wallet-balance-card > strong")).to_contain_text("0")
    response = page.request.get(BASE + "/api/wallet/me")
    assert response.ok, response.text()
    wallet = response.json()
    assert float(wallet["balance"]) == 0
    return wallet["id"]


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    first_context = browser.new_context(viewport={"width": 1280, "height": 900})
    second_context = browser.new_context(viewport={"width": 390, "height": 844})
    first = first_context.new_page()
    second = second_context.new_page()
    for width in (360, 768, 1280):
        first.set_viewport_size({"width": width, "height": 900})
        for screen in ("login", "register"):
            first.goto(BASE + "/wallet/" + screen, wait_until="networkidle")
            assert first.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"Wallet {screen} overflow at {width}px"
            first.screenshot(path=str(ARTIFACTS / f"wallet-{screen}-{width}.png"), full_page=True)
    first.set_viewport_size({"width": 1280, "height": 900})
    suffix = uuid4().hex[:12]
    password = "Wallet-smoke-" + uuid4().hex
    first_id = register_and_login(first, f"wallet-a-{suffix}@example.test", password)
    second_id = register_and_login(second, f"wallet-b-{suffix}@example.test", password)
    assert first_id != second_id
    expect(first.locator(".wallet-guide")).to_contain_text("1/3 completed")
    first.get_by_role("button", name="Hide guide", exact=True).click()
    first.reload()
    expect(first.get_by_role("button", name="Show getting started guide")).to_be_visible()
    first.get_by_role("button", name="Show getting started guide").click()
    expect(first.locator(".wallet-guide")).to_contain_text("1/3 completed")
    first.screenshot(path=str(ARTIFACTS / "onboarding-desktop.png"), full_page=True)
    second.screenshot(path=str(ARTIFACTS / "onboarding-mobile.png"), full_page=True)

    first.get_by_role("link", name="Receive", exact=True).click()
    expect(first.locator("#wallet-receive code")).to_have_text(first_id)
    first.get_by_text("Receive a transfer", exact=True).click()
    expect(first.locator("#wallet-receive code")).not_to_be_visible()
    first.get_by_role("link", name="Top up", exact=True).click()
    expect(first).to_have_url(BASE + "/wallet#wallet-topup")
    second.get_by_role("link", name="Activity", exact=True).click()
    expect(second).to_have_url(BASE + "/wallet#wallet-activity")
    second.get_by_role("link", name="Home", exact=True).click()
    expect(second).to_have_url(BASE + "/wallet#wallet-overview")

    first.locator(".wallet-action-grid > section").nth(0).get_by_label("Amount (Rp)").fill("100")
    first.get_by_role("button", name="Add simulated funds").click()
    expect(first.get_by_role("status")).to_contain_text("Simulated top up")
    expect(first.locator(".wallet-balance-card > strong")).to_contain_text("100")

    expect(first.locator(".wallet-guide")).to_contain_text("2/3 completed")
    first.get_by_role("button", name="View receipt", exact=True).click()
    details = first.get_by_role("dialog")
    expect(details).to_contain_text("Simulated top up")
    expect(details).to_contain_text("Simulator treasury")
    expect(details).to_contain_text("Completed")
    for _ in range(6):
        first.keyboard.press("Tab")
        expect(first.locator(".wallet-receipt-dialog:focus, .wallet-receipt-dialog :focus")).to_have_count(1)
    first.keyboard.press("Escape")
    expect(details).not_to_be_visible()
    expect(first.get_by_role("button", name="View receipt", exact=True)).to_be_focused()
    first.get_by_role("link", name="Send money", exact=True).click()
    expect(first).to_have_url(BASE + "/wallet#wallet-send")
    first.get_by_label("Recipient wallet ID").fill(second_id)
    first.get_by_role("button", name="Find recipient").click()
    expect(first.locator(".wallet-recipient")).to_contain_text(f"wallet-b-{suffix}")
    first.locator(".wallet-action-grid > section").nth(1).get_by_label("Amount (Rp)").fill("25")
    first.get_by_role("button", name="Confirm transfer").click()
    expect(first.get_by_role("status")).to_contain_text("Transfer completed")
    expect(first.locator(".wallet-balance-card > strong")).to_contain_text("75")
    expect(first.locator(".wallet-entry")).to_have_count(2)
    expect(first.locator(".wallet-guide")).to_contain_text("3/3 completed")
    first.get_by_role("button", name="View receipt", exact=True).click()
    expect(first.get_by_role("dialog")).to_contain_text(f"wallet-b-{suffix}")
    first.screenshot(path=str(ARTIFACTS / "receipt-desktop.png"), full_page=False)
    first.emulate_media(media="print")
    expect(first.locator(".wallet-page")).not_to_be_visible()
    expect(first.locator(".wallet-receipt-disclaimer")).to_be_visible()
    expect(first.get_by_role("button", name="Print / save PDF")).not_to_be_visible()
    first.pdf(path=str(ARTIFACTS / "wallet-receipt.pdf"), format="A4")
    first.emulate_media(media="screen")
    first.get_by_role("button", name="Close transaction details").click()
    first.reload()
    expect(first.locator(".wallet-guide")).to_contain_text("3/3 completed")
    second.reload()
    expect(second.locator(".wallet-balance-card > strong")).to_contain_text("25")
    expect(second.locator(".wallet-entry")).to_have_count(1)

    # Incoming funds are not a treasury topup or first outgoing transfer.
    expect(second.locator(".wallet-guide")).to_contain_text("1/3 completed")
    second.locator(".wallet-entry").first.click()
    expect(second.get_by_role("dialog")).to_contain_text("Money received")
    assert second.evaluate("document.documentElement.scrollWidth <= innerWidth")
    second.screenshot(path=str(ARTIFACTS / "receipt-mobile.png"), full_page=False)
    second.keyboard.press("Escape")
    expect(second.locator(".wallet-entry").first).to_be_focused()
    denied_id = first.request.get(BASE + "/api/wallet/history").json()["content"][-1]["transferId"]
    assert second.request.get(BASE + "/api/wallet/transactions/" + denied_id).status == 404
    # A transient details failure must offer a retry without financial writes.
    first.route("**/api/wallet/transactions/*", lambda route: route.fulfill(status=502, json={"message":"Temporary receipt failure"}))
    first.locator(".wallet-entry").first.click()
    expect(first.get_by_role("alert")).to_contain_text("Temporary receipt failure")
    first.unroute("**/api/wallet/transactions/*")
    first.get_by_role("button", name="Retry details").click()
    expect(first.get_by_role("dialog")).to_contain_text("Money sent")
    first.keyboard.press("Escape")

    first.route("**/api/wallet/progress", lambda route: route.fulfill(status=503, json={"message":"Progress unavailable"}))
    first.reload()
    expect(first.locator(".wallet-guide")).to_contain_text("Progress could not be loaded")
    first.unroute("**/api/wallet/progress")
    first.get_by_role("button", name="Try again", exact=True).click()
    expect(first.locator(".wallet-guide")).to_contain_text("3/3 completed")

    # Lose the HTTP response after the backend commits, then retry unchanged.
    def lose_confirmation(route):
        response = route.fetch()
        assert response.ok, response.text()
        route.abort("failed")

    first.route("**/api/wallet/topups", lose_confirmation, times=1)
    first.locator(".wallet-action-grid > section").nth(0).get_by_label("Amount (Rp)").fill("10")
    first.get_by_role("button", name="Add simulated funds").click()
    expect(first.get_by_role("alert")).to_be_visible()
    first.reload()
    expect(first.locator(".wallet-action-grid > section").nth(0).get_by_label("Amount (Rp)")).to_have_value("10")
    first.get_by_role("button", name="Add simulated funds").click()
    expect(first.get_by_role("status")).to_contain_text("Simulated top up")
    expect(first.locator(".wallet-balance-card > strong")).to_contain_text("85")
    expect(first.locator(".wallet-entry")).to_have_count(3)

    # Definitively rejected amounts must not trap the user in an unresolved retry.
    topup_amount = first.locator(".wallet-action-grid > section").nth(0).get_by_label("Amount (Rp)")
    topup_amount.fill("1000001")
    first.get_by_role("button", name="Add simulated funds").click()
    expect(first.get_by_role("alert")).to_be_visible()
    expect(topup_amount).to_be_enabled()

    assert first.request.get(BASE + "/api/backend/accounts").status == 401
    first.goto(BASE + "/accounts")
    expect(first).to_have_url(BASE + "/wallet")
    expect(first.get_by_role("link", name="Accounts", exact=True)).to_have_count(0)
    assert second.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    first.screenshot(path=str(ARTIFACTS / "wallet-desktop.png"), full_page=True)
    second.screenshot(path=str(ARTIFACTS / "wallet-mobile.png"), full_page=True)
    first.set_viewport_size({"width": 768, "height": 1024})
    assert first.evaluate("document.documentElement.scrollWidth <= innerWidth"), "Wallet tablet overflow"
    first.screenshot(path=str(ARTIFACTS / "wallet-tablet.png"), full_page=True)
    first.set_viewport_size({"width": 1280, "height": 900})

    admin_email = os.environ.get("WALLET_SMOKE_ADMIN_EMAIL")
    admin_password = os.environ.get("WALLET_SMOKE_ADMIN_PASSWORD")
    if admin_email and admin_password:
        api_context = p.request.new_context(base_url=API)
        login = api_context.post("/api/auth/login", data={"email": admin_email, "password": admin_password})
        assert login.ok, login.text()
        headers = {"Authorization": "Bearer " + login.json()["accessToken"]}
        accounts = api_context.get("/api/accounts", headers=headers)
        assert accounts.ok, accounts.text()
        balances = {a["id"]: a["currentBalance"] for a in accounts.json()}
        assert float(balances[first_id]) == 85
        assert float(balances[second_id]) == 25
        statement = api_context.get(f"/api/accounts/{first_id}/statement", headers=headers)
        assert statement.ok and statement.json()["totalElements"] == 3
        report = api_context.get("/api/reconciliation", headers=headers)
        assert report.ok, report.text()
        body = report.json()
        assert body["status"] == "BALANCED", json.dumps(body)
        audit = api_context.get("/api/audit?size=100", headers=headers)
        assert audit.ok, audit.text()
        actions = {e["action"] for e in audit.json()["content"]}
        assert {"SIMULATOR_TOPUP", "CUSTOMER_TRANSFER_COMPLETED"}.issubset(actions)
        freeze = api_context.post(f"/api/accounts/{first_id}/freeze", headers=headers,
                                  data={"reason": "Wallet browser smoke freeze"})
        assert freeze.ok, freeze.text()
        first.reload(wait_until="networkidle")
        expect(first.locator(".wallet-action-grid > section").nth(0).get_by_label("Amount (Rp)")).to_be_disabled()
        expect(first.get_by_label("Recipient wallet ID")).to_be_disabled()
        unfreeze = api_context.post(f"/api/accounts/{first_id}/unfreeze", headers=headers,
                                    data={"reason": "Wallet browser smoke unfreeze"})
        assert unfreeze.ok, unfreeze.text()
        first.reload(wait_until="networkidle")
        expect(first.locator(".wallet-action-grid > section").nth(0).get_by_label("Amount (Rp)")).to_be_enabled()
        api_context.dispose()
        print("Internal balances, statements, audit, and reconciliation passed.")
    else:
        print("Internal verification skipped: admin credentials were not supplied.")

    first.get_by_role("button", name="Sign out").click()
    expect(first).to_have_url(BASE + "/wallet/login")
    assert first.request.get(BASE + "/api/wallet/me").status == 401
    first_context.add_cookies([{"name": "ledgerflow_customer_access_token", "value": "expired-smoke-token", "url": BASE}])
    first.goto(BASE + "/wallet")
    expect(first).to_have_url(BASE + "/wallet/login")
    browser.close()
    print("Wallet full-stack browser smoke passed.")
