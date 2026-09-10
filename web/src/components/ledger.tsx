"use client";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Entry,
  Transfer,
  api,
  cents,
  money,
  shortId,
  stamp,
} from "@/lib/domain";
import { useWorkspace } from "./workspace";
import { Copy, Empty, Modal, Notice, PageHeading } from "./ui";
export function LedgerPage() {
  const store = useWorkspace();
  const params = useSearchParams();
  const [account, setAccount] = useState(params.get("account") || "");
  const [direction, setDirection] = useState("");
  const [query, setQuery] = useState(params.get("transaction") || "");
  const [date, setDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [live, setLive] = useState<Entry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Entry>();
  const [pair, setPair] = useState<Entry[]>([]);
  const [detailError, setDetailError] = useState("");
  const [detailBusy, setDetailBusy] = useState(false);
  const [page, setPage] = useState(0);
  useEffect(() => {
    if (store.mode !== "live" || !account) return;
    let active = true;
    api<Entry[]>(`accounts/${account}/statement`)
      .then((data) => {
        if (active) {
          setLive(data);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [account, store.mode]);
  useEffect(() => {
    if (!selected) return;
    let active = true;
    const run = async () => {
      try {
        let entries: Entry[];
        if (store.mode === "demo")
          entries = store.entries.filter(
            (e) => e.transferId === selected.transferId,
          );
        else {
          const t = await api<Transfer>(`transfers/${selected.transferId}`);
          const lists = await Promise.all([
            api<Entry[]>(`accounts/${t.sourceAccountId}/statement`),
            api<Entry[]>(`accounts/${t.targetAccountId}/statement`),
          ]);
          entries = [
            ...new Map(
              lists
                .flat()
                .filter((e) => e.transferId === t.id)
                .map((e) => [e.id, e]),
            ).values(),
          ];
        }
        if (active) setPair(entries);
      } catch (e) {
        if (active) setDetailError((e as Error).message);
      } finally {
        if (active) setDetailBusy(false);
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [selected, store.mode, store.entries]);
  const source = store.mode === "demo" ? store.entries : account ? live : [];
  const rows = source.filter(
    (e) =>
      (!account || e.accountId === account) &&
      (!direction || e.direction === direction) &&
      e.transferId.toLowerCase().includes(query.toLowerCase()) &&
      (!date ||
        Date.parse(e.createdAt) >= Date.parse(`${date}T00:00:00+07:00`)) &&
      (!endDate ||
        Date.parse(e.createdAt) <= Date.parse(`${endDate}T23:59:59.999+07:00`)),
  );
  const debit = pair
    .filter((e) => e.direction === "DEBIT")
    .reduce((n, e) => n + cents(e.amount), BigInt(0));
  const credit = pair
    .filter((e) => e.direction === "CREDIT")
    .reduce((n, e) => n + cents(e.amount), BigInt(0));
  function exportCsv() {
    const escape = (s: string) => `"${s.replaceAll('"', '""')}"`;
    const csv = [
      [
        "Timestamp",
        "Entry ID",
        "Transaction ID",
        "Account ID",
        "Direction",
        "Amount IDR",
      ],
      ...rows.map((e) => [
        stamp(e.createdAt),
        e.id,
        e.transferId,
        e.accountId,
        e.direction,
        e.amount,
      ]),
    ]
      .map((r) => r.map(escape).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "ledger-filtered.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <PageHeading
        title="Ledger"
        description="Inspect postings and trace their parent transactions."
        action={
          <button disabled={!rows.length} onClick={exportCsv}>
            Export filtered CSV ↓
          </button>
        }
      />
      <section className="panel">
        <div className="toolbar ledger-filters">
          <label>
            Account
            <select
              value={account}
              onChange={(e) => {
                setAccount(e.target.value);
                setLive([]);
                setError("");
                setBusy(store.mode === "live" && !!e.target.value);
                setPage(0);
              }}
            >
              <option value="">
                {store.mode === "demo" ? "All accounts" : "Select an account"}
              </option>
              {store.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Direction
            <select
              value={direction}
              onChange={(e) => {
                setDirection(e.target.value);
                setPage(0);
              }}
            >
              <option value="">All entries</option>
              <option>DEBIT</option>
              <option>CREDIT</option>
            </select>
          </label>
          <label>
            Transaction ID
            <input
              value={query}
              placeholder="Search transaction ID"
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
            />
          </label>
          <label>
            From
            <input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setPage(0);
              }}
            />
          </label>
          <label>
            To
            <input
              type="date"
              min={date}
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(0);
              }}
            />
          </label>
        </div>
        <div className="table-footer">
          <span>Asia/Jakarta · Export includes filtered rows only</span>
          <button
            onClick={() => {
              setDirection("");
              setQuery("");
              setDate("");
              setEndDate("");
              setPage(0);
            }}
          >
            Clear filters
          </button>
        </div>
      </section>
      <div className="reconciliation">
        <span className="badge">PARTIAL VIEW</span>
        <div>
          <strong>Global reconciliation is not available</strong>
          <p>
            Account statements and filtered entries do not independently need to
            balance. Inspect a transaction to compare its postings.
          </p>
        </div>
      </div>
      {error && <Notice danger>{error}</Notice>}
      <section className="panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Entry ID</th>
                <th>Transaction ID</th>
                <th>Account</th>
                <th>Direction</th>
                <th className="number">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(page * 15, page * 15 + 15).map((e) => (
                <tr key={e.id}>
                  <td className="date">{stamp(e.createdAt)}</td>
                  <td className="mono muted">
                    {shortId(e.id)}
                    <Copy value={e.id} />
                  </td>
                  <td>
                    <button
                      className="plain link mono"
                      onClick={() => {
                        setSelected(e);
                        setPair([]);
                        setDetailError("");
                        setDetailBusy(true);
                      }}
                    >
                      {shortId(e.transferId)}
                    </button>
                  </td>
                  <td>
                    {store.accounts.find((a) => a.id === e.accountId)?.name ||
                      shortId(e.accountId)}
                  </td>
                  <td>
                    <span className="badge">{e.direction}</span>
                  </td>
                  <td className="number">{money(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <Empty title={busy ? "Loading statement…" : "No journal entries"}>
            {store.mode === "live" && !account
              ? "Select an account to retrieve its statement."
              : "Create a transfer or adjust the filters to inspect postings."}
          </Empty>
        )}
        <div className="table-footer">
          <span>{rows.length} entries · No global balance claim</span>
          <div className="inline">
            <button disabled={!page} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <span>Page {page + 1}</span>
            <button
              disabled={(page + 1) * 15 >= rows.length}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </section>
      {selected && (
        <Modal
          drawer
          title="Transaction details"
          onClose={() => setSelected(undefined)}
        >
          <small>TRANSACTION REFERENCE</small>
          <p className="mono wrap">
            {selected.transferId}
            <Copy value={selected.transferId} />
          </p>
          <p>{stamp(selected.createdAt)}</p>
          <hr />
          <h3>Journal postings</h3>
          {detailBusy && <p>Loading counterpart entries…</p>}
          {detailError && <Notice danger>{detailError}</Notice>}
          {pair.map((e) => (
            <div className="posting" key={e.id}>
              <span className="badge">{e.direction}</span>
              <h3>
                {store.accounts.find((a) => a.id === e.accountId)?.name ||
                  e.accountId}
              </h3>
              <strong className="money-large">{money(e.amount)}</strong>
              <p className="mono muted">
                {shortId(e.id)}
                <Copy value={e.id} />
              </p>
            </div>
          ))}
          {!detailBusy && !detailError && pair.length >= 2 ? (
            <section className="balance-block">
              <div className="balance-row">
                <span>Total debit</span>
                <strong>{money(debit)}</strong>
              </div>
              <div className="balance-row">
                <span>Total credit</span>
                <strong>{money(credit)}</strong>
              </div>
              <div className="balance-row after">
                <span>Difference</span>
                <strong>{money(debit - credit)}</strong>
              </div>
              <p>
                {debit === credit
                  ? "Balanced within the retrieved transaction entries."
                  : "Non-zero difference in retrieved entries."}
              </p>
            </section>
          ) : (
            <Notice>
              Unable to verify until counterpart entries are available.
            </Notice>
          )}
          <p className="muted">
            Read-only inspection. No cryptographic proof or global audit is
            implied.
          </p>
        </Modal>
      )}
    </>
  );
}
