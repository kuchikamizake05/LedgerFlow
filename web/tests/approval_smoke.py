"""Mocked live approval queue, self-approval guard, paging, filters and decision retries."""
import json
import os
from urllib.parse import parse_qs, urlparse
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("BASE_URL", "http://127.0.0.1:3200")
ACCOUNT_ID = "10000000-0000-4000-8000-000000000001"
ADMIN = "admin@example.test"
OTHER = "operator@example.test"


def request(identifier, requester, status="PENDING"):
    return {
        "id": identifier,
        "sourceAccountId": ACCOUNT_ID,
        "targetAccountId": "10000000-0000-4000-8000-000000000002",
        "amount": "1250.50",
        "idempotencyKey": f"reference-{identifier[-4:]}",
        "description": "Invoice 884",
        "status": status,
        "requesterId": f"user-{requester}",
        "requesterEmail": requester,
        "createdAt": "2026-10-08T03:00:00Z",
        "decisionActorEmail": ADMIN if status != "PENDING" else None,
        "decisionReason": "Previously reviewed" if status != "PENDING" else None,
        "decidedAt": "2026-10-08T04:00:00Z" if status != "PENDING" else None,
        "completedTransferId": "20000000-0000-4000-8000-000000000099" if status == "APPROVED" else None,
    }


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    context.add_cookies([{"name": "ledgerflow_access_token", "value": "mock-only", "url": BASE}])
    page = context.new_page()
    state = {
        "items": [request(f"40000000-0000-4000-8000-{i:012d}", ADMIN if i == 1 else OTHER) for i in range(1, 12)],
        "rejected": request("40000000-0000-4000-8000-000000000099", OTHER, "REJECTED"),
        "approve_calls": [],
        "request_calls": [],
        "direct_transfer_calls": [],
        "fail_all": False,
    }

    def backend(route):
        req = route.request
        parsed = urlparse(req.url)
        path = parsed.path.split("/api/backend/", 1)[-1]
        if path == "accounts":
            return route.fulfill(json=[
                {"id": ACCOUNT_ID, "name": "Operating account", "type": "BANK", "openingBalance": "5000.00", "currentBalance": "5000.00", "createdAt": "2026-10-01T00:00:00Z"},
                {"id": "10000000-0000-4000-8000-000000000002", "name": "Destination account", "type": "BANK", "openingBalance": "5000.00", "currentBalance": "5000.00", "createdAt": "2026-10-01T00:00:00Z"},
            ])
        if path == "transfer-requests" and req.method == "POST":
            state["request_calls"].append(req.post_data_json)
            body = req.post_data_json
            return route.fulfill(status=201, json={
                **body,
                "id": "40000000-0000-4000-8000-000000000088",
                "status": "PENDING",
                "requesterId": "operator-user",
                "requesterEmail": "operator@example.test",
                "createdAt": "2026-10-09T03:00:00Z",
            })
        if path == "transfers" and req.method == "POST":
            state["direct_transfer_calls"].append(req.post_data_json)
            return route.fulfill(status=500, json={"message": "Ordinary transfers must be approval requests"})
        if path == "transfer-requests" and req.method == "GET":
            query = parse_qs(parsed.query)
            if state["fail_all"] and "status" not in query:
                return route.fulfill(status=503, json={"message": "Mock queue unavailable"})
            status = query.get("status", ["ALL"])[0]
            source = [item for item in state["items"] if item["status"] == "PENDING"]
            if status == "APPROVED":
                source = [item for item in state["items"] if item["status"] == "APPROVED"]
            elif status == "REJECTED":
                source = [item for item in state["items"] if item["status"] == "REJECTED"] + [state["rejected"]]
            elif status == "ALL":
                source = state["items"] + [state["rejected"]]
            page_index = int(query.get("page", ["0"])[0])
            page_size = int(query.get("size", ["10"])[0])
            start = page_index * page_size
            return route.fulfill(json={
                "content": source[start:start + page_size],
                "page": page_index,
                "size": page_size,
                "totalElements": len(source),
                "totalPages": (len(source) + page_size - 1) // page_size,
                "hasNext": start + page_size < len(source),
            })
        if path.startswith("transfer-requests/") and req.method == "GET":
            identifier = path.split("/")[1]
            match = next((item for item in state["items"] if item["id"] == identifier), None)
            if not match and state["rejected"]["id"] == identifier:
                match = state["rejected"]
            return route.fulfill(json=match or {"message": "Missing request"}, status=200 if match else 404)
        if path.startswith("transfer-requests/") and req.method == "POST":
            _, identifier, action = path.split("/")
            item = next(item for item in state["items"] if item["id"] == identifier)
            body = req.post_data_json
            state["approve_calls"].append({"path": path, "body": body})
            if len(state["approve_calls"]) == 1:
                # The server changed state, but the response was lost to the client.
                item["status"] = "APPROVED"
                item["decisionReason"] = body["reason"]
                item["decisionActorEmail"] = ADMIN
                item["decidedAt"] = "2026-10-09T03:00:00Z"
                item["completedTransferId"] = "20000000-0000-4000-8000-000000000099"
                return route.fulfill(status=503, json={"message": "Decision response unavailable"})
            item["status"] = "APPROVED" if action == "approve" else "REJECTED"
            item["decisionReason"] = body["reason"]
            item["decisionActorEmail"] = ADMIN
            item["decidedAt"] = "2026-10-09T03:00:00Z"
            if action == "approve":
                item["completedTransferId"] = "20000000-0000-4000-8000-000000000099"
            return route.fulfill(json=item)
        return route.fulfill(status=404, json={"message": f"Unexpected mock request: {path}"})

    page.route("**/api/auth/session", lambda route: route.fulfill(json={"id": "50000000-0000-4000-8000-000000000001", "email": ADMIN, "role": "TREASURY_ADMIN"}))
    page.route("**/api/backend/**", backend)
    page.goto(BASE + "/approvals")
    page.get_by_role("combobox", name="Data source").click()
    page.get_by_role("option", name="Local API").click()
    page.get_by_role("button", name="Continue to Local API").click()
    expect(page.get_by_role("heading", name="Approvals", exact=True)).to_be_visible()
    expect(page.locator("tbody tr")).to_have_count(10)
    expect(page.get_by_role("button", name="Next", exact=True)).to_be_enabled()
    page.get_by_role("button", name="Next", exact=True).click()
    expect(page.get_by_text("Page 2 of 2")).to_be_visible()
    page.get_by_role("button", name="Previous", exact=True).click()

    page.get_by_role("button", name="Review", exact=True).first.click()
    expect(page.get_by_role("region", name="Selected transfer request")).to_contain_text("You submitted this request")
    expect(page.get_by_label("Decision reason")).to_have_count(0)
    expect(page.get_by_role("button", name="Approve transfer", exact=True)).to_have_count(0)

    page.get_by_role("button", name="Review", exact=True).nth(1).click()
    expect(page.get_by_label("Decision reason")).to_be_visible()
    page.get_by_label("Decision reason").fill("Reviewed invoice 884")
    approve = page.get_by_role("button", name="Approve transfer", exact=True)
    approve.click()
    expect(page.locator(".notice.danger").first).to_contain_text("Decision response unavailable")
    expect(page.get_by_label("Decision reason")).to_be_disabled()
    expect(page.get_by_role("button", name="Reject request", exact=True)).to_have_count(0)
    expect(page.get_by_role("button", name="Retry same approval", exact=True)).to_be_visible()
    page.get_by_role("button", name="Retry same approval", exact=True).click()
    assert len(state["approve_calls"]) == 2
    assert state["approve_calls"][0] == state["approve_calls"][1]
    assert state["approve_calls"][0]["body"] == {"reason": "Reviewed invoice 884"}

    page.get_by_role("button", name="Review", exact=True).nth(1).click()
    page.get_by_label("Decision reason").fill("Beneficiary details do not match")
    page.get_by_role("button", name="Reject request", exact=True).click()
    assert state["approve_calls"][-1]["path"].endswith("/reject")
    assert state["approve_calls"][-1]["body"] == {"reason": "Beneficiary details do not match"}

    page.get_by_label("Filter approval requests by status").select_option("REJECTED")
    expect(page.locator("tbody")).to_contain_text("REJECTED")
    page.get_by_role("button", name="Review", exact=True).last.click()
    expect(page.get_by_text("Previously reviewed", exact=True)).to_be_visible()
    state["fail_all"] = True
    page.get_by_label("Filter approval requests by status").select_option("ALL")
    expect(page.get_by_text("Mock queue unavailable", exact=True)).to_be_visible()
    expect(page.get_by_text("Listed requests may be stale")).to_be_visible()
    context.close()

    operator_context = browser.new_context()
    operator_context.add_cookies([{"name": "ledgerflow_access_token", "value": "mock-only", "url": BASE}])
    operator = operator_context.new_page()
    operator.route("**/api/auth/session", lambda route: route.fulfill(json={"id": "50000000-0000-4000-8000-000000000002", "email": "operator@example.test", "role": "OPERATOR"}))
    operator.route("**/api/backend/**", backend)
    operator.goto(BASE + "/approvals")
    operator.get_by_role("combobox", name="Data source").click()
    operator.get_by_role("option", name="Local API").click()
    operator.get_by_role("button", name="Continue to Local API").click()
    expect(operator.get_by_role("heading", name="Approvals", exact=True)).to_be_visible()
    expect(operator.get_by_role("button", name="Review", exact=True).first).to_be_visible()
    expect(operator.get_by_role("button", name="Approve transfer", exact=True)).to_have_count(0)
    expect(operator.get_by_role("button", name="Reject request", exact=True)).to_have_count(0)
    operator.goto(BASE + "/transfers")
    operator.get_by_role("combobox", name="Data source").click()
    operator.get_by_role("option", name="Local API").click()
    operator.get_by_role("button", name="Continue to Local API").click()
    operator.get_by_role("combobox", name="Source account").click()
    operator.get_by_role("option", name="Operating account").click()
    operator.get_by_label("Destination account", exact=False).fill("10000000-0000-4000-8000-000000000002")
    operator.get_by_label("Amount in IDR").fill("1250.50")
    operator.get_by_role("button", name="Review transfer", exact=True).click()
    operator.get_by_role("dialog").get_by_role("button", name="Submit for approval").click()
    expect(operator.get_by_role("heading", name="Approval requested", exact=True)).to_be_visible()
    expect(operator.get_by_text("No account balance or journal entry has changed.")).to_be_visible()
    assert len(state["request_calls"]) == 1
    assert state["request_calls"][0]["amount"] == "1250.50"
    assert state["request_calls"][0]["idempotencyKey"]
    assert state["direct_transfer_calls"] == []
    operator_context.close()
    browser.close()
    print("PASS: approval queue paging/filtering, admin self-approval guard, retry safety and read-only roles")
