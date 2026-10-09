"""Mobile navigation dismissal and focus behavior against the local app."""
import os
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("BASE_URL", "http://localhost:3200")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 390, "height": 844})
    page.context.add_cookies([{"name": "ledgerflow_access_token", "value": "smoke-only", "url": BASE}])
    page.route(
        "**/api/auth/session",
        lambda route: route.fulfill(json={"id": "50000000-0000-4000-8000-000000000001", "email": "smoke@example.test", "role": "AUDITOR"}),
    )
    page.goto(BASE + "/accounts")
    toggle = page.get_by_role("button", name="Toggle navigation")
    navigation = page.locator("#main-navigation")

    expect(toggle).to_have_attribute("aria-controls", "main-navigation")
    expect(toggle).to_have_attribute("aria-expanded", "false")
    expect(navigation).not_to_be_visible()
    toggle.click()
    expect(toggle).to_have_attribute("aria-expanded", "true")
    expect(navigation.get_by_role("link", name="Accounts", exact=True)).to_be_focused()
    page.keyboard.press("Escape")
    expect(toggle).to_have_attribute("aria-expanded", "false")
    expect(toggle).to_be_focused()

    toggle.click()
    expect(navigation).to_be_visible()
    links = navigation.get_by_role("link")
    last = links.last
    last.focus()
    page.keyboard.press("Tab")
    expect(links.first).to_be_focused()
    links.first.focus()
    page.keyboard.press("Shift+Tab")
    expect(last).to_be_focused()
    page.get_by_role("button", name="Close navigation").click(
        position={"x": 350, "y": 32}
    )
    expect(toggle).to_have_attribute("aria-expanded", "false")
    expect(toggle).to_be_focused()
    browser.close()
    print("PASS: mobile navigation exposes state, opens accessibly, and dismisses by Escape or backdrop")
