import test from "node:test";
import assert from "node:assert/strict";
import { groupWalletActivity } from "../src/lib/wallet-activity.ts";

test("wallet groups dates at Jakarta midnight while retaining API order", () => {
  const entries = [
    { id: "new", createdAt: "2026-10-09T17:30:00Z" },
    { id: "older", createdAt: "2026-10-09T16:59:00Z" },
    { id: "oldest", createdAt: "2026-10-09T10:00:00Z" },
  ];
  const groups = groupWalletActivity(entries, new Date("2026-10-10T01:00:00Z"));
  assert.deepEqual(groups.map(g => g.label), ["Today", "Yesterday"]);
  assert.deepEqual(groups.map(g => g.entries.map(e => e.id)), [["new"], ["older", "oldest"]]);
  assert.deepEqual(entries.map(e => e.id), ["new", "older", "oldest"]);
});

test("wallet labels older dates across a month boundary and safely handles missing dates", () => {
  const groups = groupWalletActivity([
    { createdAt: "2026-09-30T18:00:00Z" },
    { createdAt: "2026-09-29T18:00:00Z" },
    { createdAt: "not-a-date" },
  ], new Date("2026-10-01T20:00:00Z"));
  assert.deepEqual(groups.map(g => g.label), ["Yesterday", "30 Sept 2026", "Date unavailable"]);
  assert.deepEqual(groupWalletActivity([]), []);
});
