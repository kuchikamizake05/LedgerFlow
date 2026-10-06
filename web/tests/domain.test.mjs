import test from "node:test";
import assert from "node:assert/strict";
import * as domain from "../src/lib/domain.ts";
import {
  cents,
  decimal,
  money,
  demoAccounts,
  demoEntries,
} from "../src/lib/domain.ts";
test("live role permissions fail closed; demo allows simulated operations", () => {
  assert.equal(typeof domain.permissions, "function");
  assert.deepEqual(domain.permissions("live", "AUDITOR"), { create: false, transfer: false, deposit: false });
  assert.deepEqual(domain.permissions("live", "OPERATOR"), { create: true, transfer: true, deposit: false });
  assert.deepEqual(domain.permissions("live", "TREASURY_ADMIN"), { create: true, transfer: true, deposit: true });
  assert.deepEqual(domain.permissions("live", null), { create: false, transfer: false, deposit: false });
  assert.deepEqual(domain.permissions("demo", "AUDITOR"), { create: true, transfer: true, deposit: true });
});
test("signed reconciliation differences keep exact precision", () => {
  assert.equal(money("-99999999999999999.99"), "−Rp 99.999.999.999.999.999,99");
});
test("money retains precision above Number safe integer range", () => {
  assert.equal(cents("99999999999999999.99"), 9999999999999999999n);
  assert.equal(money("99999999999999999.99"), "Rp 99.999.999.999.999.999,99");
  assert.equal(decimal(cents("100.25") + cents("0.75")), "101.00");
});
test("rejects ambiguous and invalid amounts", () => {
  for (const input of ["", "-1", "1,000", "1e3", "1.001", "NaN"])
    assert.throws(() => cents(input));
});
test("synthetic balances reconcile with their journal postings", () => {
  for (const a of demoAccounts) {
    const delta = demoEntries
      .filter((e) => e.accountId === a.id)
      .reduce(
        (n, e) =>
          n + (e.direction === "CREDIT" ? cents(e.amount) : -cents(e.amount)),
        0n,
      );
    assert.equal(cents(a.openingBalance) + delta, cents(a.currentBalance));
  }
  const total = demoEntries.reduce(
    (n, e) =>
      n + (e.direction === "CREDIT" ? cents(e.amount) : -cents(e.amount)),
    0n,
  );
  assert.equal(total, 0n);
});
