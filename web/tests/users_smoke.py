"""User role administration, conflict handling, uncertain writes, and self-demotion."""
import os
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("BASE_URL", "http://127.0.0.1:3200")
ADMIN_ID = "50000000-0000-4000-8000-000000000001"
OTHER_ID = "50000000-0000-4000-8000-000000000002"

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    context.add_cookies([{"name": "ledgerflow_access_token", "value": "mock-only", "url": BASE}])
    page = context.new_page()
    state = {
        "users": [
            {"id": ADMIN_ID, "email": "admin@example.test", "role": "TREASURY_ADMIN"},
            {"id": OTHER_ID, "email": "reviewer@example.test", "role": "AUDITOR"},
        ],
        "session_role": "TREASURY_ADMIN",
        "allow_self_demotion": False,
        "uncertain_once": True,
        "uncertain_self_once": False,
        "demotion_conflict_once": True,
        "role_calls": [],
    }

    def backend(route):
        request = route.request
        parsed = urlparse(request.url)
        path = parsed.path.split("/api/backend/", 1)[-1]
        if path == "accounts":
            return route.fulfill(json=[])
        if path == "users" and request.method == "GET":
            if state["session_role"] != "TREASURY_ADMIN":
                return route.fulfill(status=403, json={"message": "Treasury Admin role required."})
            query = parse_qs(parsed.query)
            index = int(query.get("page", ["0"])[0])
            size = int(query.get("size", ["10"])[0])
            start = index * size
            users = state["users"]
            return route.fulfill(json={
                "content": users[start:start + size],
                "page": index,
                "size": size,
                "totalElements": len(users),
                "totalPages": (len(users) + size - 1) // size,
                "hasNext": start + size < len(users),
            })
        if path.startswith("users/") and path.endswith("/role") and request.method == "POST":
            user_id = path.split("/")[1]
            body = request.post_data_json
            state["role_calls"].append({"id": user_id, "body": body})
            user = next(user for user in state["users"] if user["id"] == user_id)
            if user_id == ADMIN_ID and body["role"] != "TREASURY_ADMIN" and state["demotion_conflict_once"] and not state["allow_self_demotion"]:
                state["demotion_conflict_once"] = False
                return route.fulfill(status=409, json={"message": "Cannot remove the last Treasury Admin."})
            user["role"] = body["role"]
            if user_id == ADMIN_ID:
                state["session_role"] = body["role"]
                if state["uncertain_self_once"]:
                    state["uncertain_self_once"] = False
                    return route.fulfill(status=503, json={"message": "Role change response unavailable."})
            if user_id == OTHER_ID and state["uncertain_once"]:
                state["uncertain_once"] = False
                return route.fulfill(status=503, json={"message": "Role change response unavailable."})
            return route.fulfill(json=user)
        return route.fulfill(status=404, json={"message": f"Unexpected API request: {path}"})

    page.route("**/api/auth/session", lambda route: route.fulfill(json={
        "id": ADMIN_ID, "email": "admin@example.test", "role": state["session_role"]
    }))
    page.route("**/api/backend/**", backend)
    page.goto(BASE + "/users")
    page.get_by_role("combobox", name="Data source").click()
    page.get_by_role("option", name="Local API").click()
    page.get_by_role("button", name="Continue to Local API").click()
    expect(page.get_by_role("heading", name="Users and roles")).to_be_visible()
    expect(page.get_by_role("link", name="Users")).to_be_visible()
    expect(page.locator("tbody tr")).to_have_count(2)

    reviewer = page.get_by_role("row", name="reviewer@example.test AUDITOR")
    reviewer.get_by_role("button", name="Review").click()
    page.get_by_label("Workspace role").select_option("OPERATOR")
    page.get_by_label("Role change reason").fill("Operations coverage approved")
    page.get_by_role("button", name="Review role change").click()
    expect(page.get_by_role("alertdialog")).to_be_visible()
    page.keyboard.press("Escape")
    expect(page.get_by_role("alertdialog")).to_have_count(0)
    assert state["role_calls"] == []
    page.get_by_role("button", name="Review role change").click()
    page.get_by_role("button", name="Confirm role change").click()
    expect(page.locator(".notice.danger").first).to_contain_text("request outcome is uncertain")
    expect(page.locator(".notice.danger").first).to_contain_text("latest persisted role for reviewer@example.test is OPERATOR")
    assert state["role_calls"][0]["body"] == {"role": "OPERATOR", "reason": "Operations coverage approved"}

    admin_row = page.get_by_role("row").filter(has_text="admin@example.test")
    admin_row.get_by_role("button", name="Review").click()
    page.get_by_label("Workspace role").select_option("AUDITOR")
    page.get_by_label("Role change reason").fill("Admin duties transferred")
    page.get_by_role("button", name="Review role change").click()
    page.get_by_role("button", name="Confirm role change").click()
    expect(page.locator(".notice.danger").first).to_contain_text("Cannot remove the last Treasury Admin")
    assert state["users"][0]["role"] == "TREASURY_ADMIN"

    state["allow_self_demotion"] = True
    state["uncertain_self_once"] = True
    page.get_by_label("Workspace role").select_option("AUDITOR")
    page.get_by_role("button", name="Review role change").click()
    page.get_by_role("button", name="Confirm role change").click()
    expect(page.locator(".notice.danger").first).to_contain_text("request outcome is uncertain")
    expect(page.locator(".notice.danger").first).to_contain_text("current role could not be reloaded")
    expect(page.locator(".topbar")).to_contain_text("AUDITOR")
    expect(page.get_by_role("link", name="Users")).to_have_count(0)
    assert state["role_calls"][-1]["body"] == {"role": "AUDITOR", "reason": "Admin duties transferred"}
    context.close()
    browser.close()
