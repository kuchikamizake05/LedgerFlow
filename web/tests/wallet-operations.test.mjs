import test from "node:test";
import assert from "node:assert/strict";
import { canReleaseWalletRequestKey } from "../src/lib/wallet-operations.ts";

test("wallet keeps request references for idempotency conflicts and uncertain server failures", () => {
  assert.equal(canReleaseWalletRequestKey(409), false);
  assert.equal(canReleaseWalletRequestKey(500), false);
  assert.equal(canReleaseWalletRequestKey(502), false);
});

test("wallet releases request references after known validation or policy rejection", () => {
  assert.equal(canReleaseWalletRequestKey(400), true);
  assert.equal(canReleaseWalletRequestKey(403), true);
});
