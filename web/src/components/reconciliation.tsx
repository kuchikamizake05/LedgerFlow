"use client";
import { useState } from "react";
import { api, money, Reconciliation, shortId, stamp } from "@/lib/domain";
import { useWorkspace } from "./workspace";
import { Notice, Copy } from "./ui";

export function ReconciliationPanel() {
  const store = useWorkspace();
  const [report, setReport] = useState<Reconciliation>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function check() {
    setBusy(true);
    setReport(undefined);
    setError("");
    try { setReport(await api<Reconciliation>("reconciliation")); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <section className="panel" aria-label="Ledger reconciliation">
    <div className="toolbar">
      <h2>Ledger reconciliation</h2>
      <span className="badge">{report?.status ?? "Not checked"}</span>
      <button disabled={busy || store.mode === "demo"} onClick={() => void check()}>
        {busy ? "Checking…" : "Check reconciliation"}
      </button>
    </div>
    <div className="table-footer">
      <p>{store.mode === "demo" ? "Demo mode does not reconcile the real database. Switch to Local API to check balances and journal pairs." : "Read-only check of all accounts and journal pairs in one database snapshot. Statement filters do not affect this check."}</p>
    </div>
    {error && <Notice danger>{error}</Notice>}
    {report && <>
      <div className="table-footer">
        <span>{stamp(report.checkedAt)} · {report.accountCount} accounts checked · {report.mismatchedAccountCount} account mismatches · {report.unbalancedTransferCount} unbalanced journals</span>
      </div>
      {report.status === "BALANCED" && <Notice>All account balances match their postings and all journal pairs balance at the check time.</Notice>}
      {report.accounts.some((a) => a.status === "MISMATCH") && <div className="table-scroll">
        <table><caption>Account mismatches · difference = current − expected</caption>
          <thead><tr><th>Account</th><th>Opening</th><th>Current</th><th>Expected</th><th>Difference</th></tr></thead>
          <tbody>{report.accounts.filter((a) => a.status === "MISMATCH").map((a) => <tr key={a.accountId}>
            <td>{store.accounts.find((account) => account.id === a.accountId)?.name ?? shortId(a.accountId)}<Copy value={a.accountId} /></td>
            <td>{money(a.openingBalance)}</td><td>{money(a.currentBalance)}</td><td>{money(a.expectedBalance)}</td><td>{money(a.difference)}</td>
          </tr>)}</tbody>
        </table>
      </div>}
      {!!report.unbalancedTransfers.length && <div className="table-scroll">
        <table><caption>Unbalanced journals · difference = debit − credit</caption>
          <thead><tr><th>Transaction</th><th>Entries</th><th>Debit</th><th>Credit</th><th>Difference</th></tr></thead>
          <tbody>{report.unbalancedTransfers.map((t) => <tr key={t.transferId}>
            <td>{shortId(t.transferId)}<Copy value={t.transferId} /></td><td>{t.entryCount}</td><td>{money(t.debitTotal)}</td><td>{money(t.creditTotal)}</td><td>{money(t.difference)}</td>
          </tr>)}</tbody>
        </table>
      </div>}
      <p className="muted">This result describes the check time. Run another check after posting changes.</p>
    </>}
  </section>;
}
