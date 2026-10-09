import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { NextRequest } from "next/server.js";
import { pathToFileURL } from "node:url";

async function loadRoute(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
    .replace('"next/server"', JSON.stringify(pathToFileURL(`${process.cwd()}/node_modules/next/server.js`).href))
    .replace('import { cookies } from "next/headers";', 'const cookies = globalThis.testCookies;');
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
}
test("statement adapter forwards all encoded query filters unchanged", async () => {
  const route = await loadRoute("../src/app/api/backend/[...path]/route.ts");
  const original = globalThis.fetch;
  let upstream;
  globalThis.fetch = async (url) => { upstream = String(url); return Response.json({ content: [] }); };
  try {
    const id = "10000000-0000-4000-8000-000000000001";
    const query = "?page=2&size=15&direction=CREDIT&from=2026-10-01&to=2026-10-06&transferId=a%2Bb";
    const response = await route.GET(new NextRequest(`http://localhost/api/backend/accounts/${id}/statement${query}`), { params: Promise.resolve({ path: ["accounts", id, "statement"] }) });
    assert.equal(response.status, 200);
    assert.equal(new URL(upstream).search, query);
  } finally { globalThis.fetch = original; }
});
test("reconciliation is readable and money is retained exactly", async () => {
  const route = await loadRoute("../src/app/api/backend/[...path]/route.ts");
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response('{"expectedBalance":99999999999999999.99,"difference":-0.01,"debitTotal":12.30,"creditTotal":12.31}');
  try {
    const response = await route.GET(new NextRequest("http://localhost/api/backend/reconciliation"), { params: Promise.resolve({ path: ["reconciliation"] }) });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { expectedBalance: "99999999999999999.99", difference: "-0.01", debitTotal: "12.30", creditTotal: "12.31" });
  } finally { globalThis.fetch = original; }
});
test("session preserves cookie on backend failure and clears expired authentication", async () => {
  const original = globalThis.fetch;
  globalThis.testCookies = async () => ({ get: () => ({ value: "test-token" }) });
  const route = await loadRoute("../src/app/api/auth/session/route.ts");
  try {
    globalThis.fetch = async () => Response.json({ message: "Unavailable" }, { status: 503 });
    assert.equal((await route.GET()).headers.get("set-cookie"), null);
    globalThis.fetch = async () => Response.json({ id: "user-1", email: "updated@example.test", role: "AUDITOR" });
    const refreshed = await route.GET();
    assert.equal(refreshed.status, 200);
    assert.deepEqual(await refreshed.json(), { id: "user-1", email: "updated@example.test", role: "AUDITOR" }, "session must use the persisted backend user response");
    globalThis.fetch = async () => Response.json({ message: "Expired" }, { status: 401 });
    assert.match((await route.GET()).headers.get("set-cookie"), /ledgerflow_access_token=;/);
  } finally { globalThis.fetch = original; delete globalThis.testCookies; }
});

test("audit adapter forwards exact resource and action filters", async () => {
 const route = await loadRoute("../src/app/api/backend/[...path]/route.ts");
 const original = globalThis.fetch; let upstream;
 globalThis.fetch = async url => { upstream = String(url); return Response.json({content: []}); };
 try {
 const query = "?page=1&size=20&action=TRANSFER_REVERSED&resourceId=10000000-0000-4000-8000-000000000001";
 const response = await route.GET(new NextRequest(`http://localhost/api/backend/audit${query}`), {params: Promise.resolve({path:["audit"]})});
 assert.equal(response.status, 200); assert.equal(new URL(upstream).search, query);
 } finally {globalThis.fetch = original;}
});
test("freeze and unfreeze forward reasons and preserve write origin checks", async () => {
 const route = await loadRoute("../src/app/api/backend/[...path]/route.ts");
 const original = globalThis.fetch; const id="10000000-0000-4000-8000-000000000001"; let forwarded;
 globalThis.fetch=async (_,options)=>{forwarded=options.body;return Response.json({id,frozen:true});};
 const body=JSON.stringify({reason:"Review unusual activity"});
 try {
 for (const action of ["freeze","unfreeze"]) {
 const context={params:Promise.resolve({path:["accounts",id,action]})};
 const response=await route.POST(new NextRequest(`http://localhost/api/backend/accounts/${id}/${action}`,{method:"POST",headers:{origin:"http://localhost"},body}),context);
 assert.equal(response.status,200);assert.equal(forwarded,body);
 const denied=await route.POST(new NextRequest(`http://localhost/api/backend/accounts/${id}/${action}`,{method:"POST",headers:{origin:"https://other.example"},body}),context);
 assert.equal(denied.status,403);
 }
 }finally{globalThis.fetch=original;}
});
test("reversal forwards unchanged request and rejects cross-origin writes", async () => {
 const route = await loadRoute("../src/app/api/backend/[...path]/route.ts");
 const original = globalThis.fetch; const id="10000000-0000-4000-8000-000000000001"; let forwarded;
 globalThis.fetch=async (_,options)=>{forwarded=options.body;return Response.json({id,reversalOf:id});};
 const context={params:Promise.resolve({path:["transfers",id,"reversal"]})};
 const body=JSON.stringify({reason:"Duplicate payment",idempotencyKey:"unchanged-request"});
 try {
 const response=await route.POST(new NextRequest(`http://localhost/api/backend/transfers/${id}/reversal`,{method:"POST",headers:{origin:"http://localhost"},body}),context);
 assert.equal(response.status,200);assert.equal(forwarded,body);
 const denied=await route.POST(new NextRequest(`http://localhost/api/backend/transfers/${id}/reversal`,{method:"POST",headers:{origin:"https://other.example"},body}),context);
 assert.equal(denied.status,403);
 }finally{globalThis.fetch=original;}
});

test("transfer approval adapter supports filtered queue, detail, and guarded decisions", async () => {
 const route = await loadRoute("../src/app/api/backend/[...path]/route.ts");
 const original = globalThis.fetch;
 const id = "40000000-0000-4000-8000-000000000001";
 const query = "?page=2&size=10&status=PENDING";
 const forwarded = [];
 globalThis.fetch = async (url, options) => {
  forwarded.push({ url: String(url), options });
  return Response.json({ id, status: "PENDING" });
 };
 try {
  const list = await route.GET(new NextRequest(`http://localhost/api/backend/transfer-requests${query}`), { params: Promise.resolve({ path: ["transfer-requests"] }) });
  assert.equal(list.status, 200, "approval queue route must be forwarded");
  assert.equal(new URL(forwarded[0].url).pathname, "/api/transfer-requests");
  assert.equal(new URL(forwarded[0].url).search, query);

  const detail = await route.GET(new NextRequest(`http://localhost/api/backend/transfer-requests/${id}`), { params: Promise.resolve({ path: ["transfer-requests", id] }) });
  assert.equal(detail.status, 200, "approval detail route must be forwarded");
  assert.equal(new URL(forwarded[1].url).pathname, `/api/transfer-requests/${id}`);

  const body = JSON.stringify({ reason: "Reviewed against invoice 884" });
  const decision = await route.POST(new NextRequest(`http://localhost/api/backend/transfer-requests/${id}/approve`, { method: "POST", headers: { origin: "http://localhost" }, body }), { params: Promise.resolve({ path: ["transfer-requests", id, "approve"] }) });
  assert.equal(decision.status, 200, "approval decision route must be forwarded");
  assert.equal(forwarded[2].options.body, body);
  assert.equal(new URL(forwarded[2].url).pathname, `/api/transfer-requests/${id}/approve`);

  const denied = await route.POST(new NextRequest(`http://localhost/api/backend/transfer-requests/${id}/reject`, { method: "POST", headers: { origin: "https://other.example" }, body }), { params: Promise.resolve({ path: ["transfer-requests", id, "reject"] }) });
  assert.equal(denied.status, 403, "decision writes must retain same-origin protection");
  assert.equal(forwarded.length, 3, "cross-origin decision must not reach the backend");
 } finally { globalThis.fetch = original; }
});

test("user administration adapter forwards the page query and role change reason", async () => {
 const route = await loadRoute("../src/app/api/backend/[...path]/route.ts");
 const original = globalThis.fetch;
 const id = "50000000-0000-4000-8000-000000000001";
 const query = "?page=1&size=20";
 const calls = [];
 globalThis.fetch = async (url, options) => {
  calls.push({ url: String(url), options });
  return Response.json({ id, email: "operator@example.test", role: "OPERATOR" });
 };
 try {
  const list = await route.GET(new NextRequest(`http://localhost/api/backend/users${query}`), { params: Promise.resolve({ path: ["users"] }) });
  assert.equal(list.status, 200, "user list route must be forwarded");
  assert.equal(new URL(calls[0].url).pathname, "/api/users");
  assert.equal(new URL(calls[0].url).search, query);

  const body = JSON.stringify({ role: "OPERATOR", reason: "Role adjusted after review" });
  const change = await route.POST(new NextRequest(`http://localhost/api/backend/users/${id}/role`, { method: "POST", headers: { origin: "http://localhost", cookie: "ledgerflow_access_token=mock-token" }, body }), { params: Promise.resolve({ path: ["users", id, "role"] }) });
  assert.equal(change.status, 200, "user role change route must be forwarded");
  assert.equal(new URL(calls[1].url).pathname, `/api/users/${id}/role`);
  assert.equal(calls[1].options.body, body);
  assert.equal(calls[1].options.headers.Authorization, "Bearer mock-token");

  const denied = await route.POST(new NextRequest(`http://localhost/api/backend/users/${id}/role`, { method: "POST", headers: { origin: "https://other.example" }, body }), { params: Promise.resolve({ path: ["users", id, "role"] }) });
  assert.equal(denied.status, 403, "cross-origin role changes must be rejected");
  assert.equal(calls.length, 2, "cross-origin role changes must not reach the backend");
 } finally { globalThis.fetch = original; }
});
