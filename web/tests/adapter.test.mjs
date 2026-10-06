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
