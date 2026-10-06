"use client";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Entry,
  ApiError,
  PageResponse,
  Transfer,
  api,
  cents,
  money,
  shortId,
  stamp,
} from "@/lib/domain";
import { useWorkspace } from "./workspace";
import { ReconciliationPanel } from "./reconciliation";
import { Copy, Empty, Modal, Notice, PageHeading } from "./ui";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const isFullUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

export function LedgerPage() {
  const store = useWorkspace();
  const params = useSearchParams();
  const [account, setAccount] = useState(params.get("account") || "");
  const [direction, setDirection] = useState("");
  const [query, setQuery] = useState(params.get("transaction") || "");
  const [date, setDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [live, setLive] = useState<Entry[]>([]);
  const [livePage, setLivePage] = useState<PageResponse<Entry>>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Entry>();
  const [pair, setPair] = useState<Entry[]>([]);
  const [detailError, setDetailError] = useState("");
  const [detailBusy, setDetailBusy] = useState(false);
  const [page, setPage] = useState(0);
  const [statementReload, setStatementReload] = useState(0);
  const [transferDetails, setTransferDetails] = useState<Transfer>();
  const [detailsReload, setDetailsReload] = useState(0);
  const [reversalReason, setReversalReason] = useState("");
  const [reversalKey, setReversalKey] = useState("");
  const [reversalError, setReversalError] = useState("");
  const [reversalBusy, setReversalBusy] = useState(false);
  const [reversalUnknown, setReversalUnknown] = useState(false);
  useEffect(() => {
    if (store.mode !== "live" || !account) {
      return;
    }
    let active = true;
    const filters = new URLSearchParams({ page: String(page), size: "15" });
    if (direction) filters.set("direction", direction);
    if (isFullUuid(query.trim())) filters.set("transferId", query.trim());
    if (date) filters.set("from", date);
    if (endDate) filters.set("to", endDate);
    api<PageResponse<Entry>>(
      `accounts/${account}/statement?${filters.toString()}`,
    )
      .then((data) => {
        if (active) {
          setLive(data.content);
          setLivePage(data);
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
  }, [account, date, direction, endDate, page, query, statementReload, store.mode]);
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
        else entries = await api<Entry[]>(`transfers/${selected.transferId}/entries`);
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
  useEffect(() => {
    if (!selected) return;
    if (store.mode === "demo") return;
    let active = true;
    api<Transfer>(`transfers/${selected.transferId}`)
      .then((transfer) => {
        if (active) setTransferDetails(transfer);
      })
      .catch((e) => {
        if (active) setDetailError((e as Error).message);
      });
    return () => {
      active = false;
    };
  }, [selected, store.mode, detailsReload]);
  const shownTransfer = store.mode === "demo"
    ? store.transfers.find((transfer) => transfer.id === selected?.transferId)
    : transferDetails;
  function openDetails(entry: Entry) {
    setSelected(entry);
    setPair([]);
    setDetailError("");
    setDetailBusy(true);
    setTransferDetails(undefined);
    setReversalReason("");
    setReversalKey("");
    setReversalError("");
    setReversalUnknown(false);
    if (store.mode !== "live" || !store.sessionEmail) return;
    try {
      const raw = localStorage.getItem(`ledgerflow-pending-reversal:${store.sessionEmail}:${entry.transferId}`);
      const saved = raw ? JSON.parse(raw) as { email?: string; transferId?: string; reason?: string; idempotencyKey?: string } : null;
      if (saved?.email === store.sessionEmail && saved.transferId === entry.transferId
        && typeof saved.reason === "string" && typeof saved.idempotencyKey === "string") {
        setReversalReason(saved.reason);
        setReversalKey(saved.idempotencyKey);
        setReversalUnknown(true);
      }
    } catch {
      setReversalError("Browser storage is unavailable. Enable it before submitting a reversal so its request reference can be recovered.");
    }
  }
  const source = store.mode === "demo" ? store.entries : account ? live : [];
  const rows = store.mode === "live" ? source : source.filter(
    (e) =>
      (!account || e.accountId === account) &&
      (!direction || e.direction === direction) &&
      e.transferId.toLowerCase().includes(query.toLowerCase()) &&
      (!date ||
        Date.parse(e.createdAt) >= Date.parse(`${date}T00:00:00+07:00`)) &&
      (!endDate ||
        Date.parse(e.createdAt) <= Date.parse(`${endDate}T23:59:59.999+07:00`)),
  );
  const visibleRows =
    store.mode === "live" ? rows : rows.slice(page * 15, page * 15 + 15);
  const hasNextPage =
    store.mode === "live"
      ? (livePage?.hasNext ?? false)
      : (page + 1) * 15 < rows.length;
  const displayedPage = store.mode === "live" ? (livePage?.page ?? page) : page;
  const debit = pair
    .filter((e) => e.direction === "DEBIT")
    .reduce((n, e) => n + cents(e.amount), BigInt(0));
  const credit = pair
    .filter((e) => e.direction === "CREDIT")
    .reduce((n, e) => n + cents(e.amount), BigInt(0));
  async function reverseTransfer() {
    if (!selected || store.mode !== "live" || store.role !== "TREASURY_ADMIN" || reversalBusy) return;
    const reason = reversalReason.trim();
    if (!reason || reason.length > 255) {
      setReversalError("Enter a reason of 1 to 255 characters.");
      return;
    }
    const key = reversalKey || crypto.randomUUID();
    setReversalKey(key);
    setReversalBusy(true);
    setReversalError("");
    const storageKey = `ledgerflow-pending-reversal:${store.sessionEmail}:${selected.transferId}`;
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        email: store.sessionEmail, transferId: selected.transferId, reason, idempotencyKey: key,
      }));
    } catch {
      setReversalError("Browser storage is unavailable. Reversal was not submitted; enable storage and retry.");
      setReversalBusy(false);
      return;
    }
    try {
      await api<Transfer>(`transfers/${selected.transferId}/reversal`, {
        idempotencyKey: key,
        reason,
      });
      try { localStorage.removeItem(storageKey); } catch { /* A retained reference safely replays. */ }
      setReversalUnknown(false);
      setReversalKey("");
      setReversalReason("");
      setTransferDetails(undefined);
      setDetailsReload((value) => value + 1);
      setStatementReload((value) => value + 1);
      await store.refresh();
    } catch (e) {
      const message = (e as Error).message;
      setReversalError(message);
      const uncertain = !(e instanceof ApiError) || e.status >= 500 || e.status === 401;
      setReversalUnknown(uncertain);
      if (!uncertain) {
        try { localStorage.removeItem(storageKey); } catch { /* A retained reference safely replays. */ }
        setReversalKey("");
      }
    } finally {
      setReversalBusy(false);
    }
  }
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
            <Select
              items={[
                {
                  value: "all",
                  label:
                    store.mode === "demo"
                      ? "All accounts"
                      : "Select an account",
                },
                ...store.accounts.map((a) => ({ value: a.id, label: a.name })),
              ]}
              value={account || "all"}
              onValueChange={(value) => {
                const nextAccount = value === "all" || !value ? "" : value;
                setAccount(nextAccount);
                setLive([]);
                setLivePage(undefined);
                setError("");
                setBusy(store.mode === "live" && !!nextAccount);
                setPage(0);
              }}
            >
              <SelectTrigger aria-label="Ledger account">
                <SelectValue
                  placeholder={
                    store.mode === "demo" ? "All accounts" : "Select an account"
                  }
                />
              </SelectTrigger>
              <SelectContent className="ledgerflow-select">
                <SelectGroup>
                  <SelectItem value="all">
                    {store.mode === "demo"
                      ? "All accounts"
                      : "Select an account"}
                  </SelectItem>
                  {store.accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </label>
          <label>
            Direction
            <Select
              items={[
                { value: "all", label: "All entries" },
                { value: "DEBIT", label: "DEBIT" },
                { value: "CREDIT", label: "CREDIT" },
              ]}
              value={direction || "all"}
              onValueChange={(value) => {
                setDirection(value === "all" || !value ? "" : value);
                setPage(0);
              }}
            >
              <SelectTrigger aria-label="Entry direction">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="ledgerflow-select">
                <SelectGroup>
                  <SelectItem value="all">All entries</SelectItem>
                  <SelectItem value="DEBIT">DEBIT</SelectItem>
                  <SelectItem value="CREDIT">CREDIT</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </label>
          <label>
            Transaction UUID
            <input
              value={query}
              placeholder="Paste full transaction UUID"
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
      <ReconciliationPanel />
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
              {visibleRows.map((e) => (
                <tr key={e.id}>
                  <td className="date">{stamp(e.createdAt)}</td>
                  <td className="mono muted">
                    {shortId(e.id)}
                    <Copy value={e.id} />
                  </td>
                  <td>
                    <button
                      className="plain link mono"
                      onClick={() => openDetails(e)}
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
            <span>
              {store.mode === "live"
                ? `${rows.length} shown on this page · ${livePage?.totalElements ?? 0} total entries`
                : `${rows.length} entries · No global balance claim`}
            </span>
            <div className="inline">
              <button
                disabled={!page}
                onClick={() => {
                  setBusy(store.mode === "live");
                  setPage(page - 1);
                }}
              >
                Previous
              </button>
              <span>Page {displayedPage + 1}</span>
              <button
                disabled={!hasNextPage}
                onClick={() => {
                  setBusy(store.mode === "live");
                  setPage(page + 1);
                }}
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
          <h3>Transfer record</h3>
          {shownTransfer ? (
            <dl className="detail-list">
              <dt>Status</dt>
              <dd>{shownTransfer.status}</dd>
              <dt>Amount</dt>
              <dd>{money(shownTransfer.amount)}</dd>
              <dt>Request reference</dt>
              <dd className="mono wrap">{shownTransfer.idempotencyKey}</dd>
              {shownTransfer.reversalOf && <>
                <dt>Reverses</dt>
                <dd className="mono wrap">
                  <Link href={`/ledger?transaction=${shownTransfer.reversalOf}`}>
                    {shownTransfer.reversalOf}
                  </Link>
                </dd>
              </>}
              <dt>Description</dt>
              <dd>{shownTransfer.description}</dd>
            </dl>
          ) : detailBusy ? <p>Loading transfer metadata…</p> : null}
          {store.mode === "demo" && (
            <Notice>Audit and reversal are unavailable in demo mode. Synthetic activity does not create persisted records.</Notice>
          )}
          {store.mode === "live" && store.role === "TREASURY_ADMIN" && transferDetails && (
            <section className="balance-block">
              <h3>Compensating reversal</h3>
              {transferDetails.status === "REVERSED" ? (
                <Notice>This transfer has already been reversed. Its original journal remains in the ledger.</Notice>
              ) : transferDetails.reversalOf ? (
                <Notice>A compensating transfer cannot be reversed.</Notice>
              ) : transferDetails.status !== "COMPLETED" ? (
                <Notice>Only a completed transfer can be reversed.</Notice>
              ) : (
                <>
                  <label>
                    Reason for reversal
                    <textarea
                      required
                      maxLength={255}
                      value={reversalReason}
                      disabled={reversalBusy || reversalUnknown}
                      onChange={(e) => setReversalReason(e.target.value)}
                      aria-label="Reason for reversal"
                      placeholder="Explain why this completed transfer must be reversed"
                    />
                    <small>{reversalReason.length}/255 characters</small>
                  </label>
                  {reversalUnknown && <Notice>
                    The result is unconfirmed. Retry only with this saved request reference: <span className="mono">{reversalKey}</span>
                  </Notice>}
                  {reversalError && <Notice danger>{reversalError}</Notice>}
                  <div className="form-actions">
                    <span className="muted">This posts a new balancing transfer. Original entries stay unchanged.</span>
                    <button
                      className="primary"
                      disabled={reversalBusy || !reversalReason.trim() || reversalReason.length > 255}
                      onClick={() => void reverseTransfer()}
                    >
                      {reversalBusy ? "Submitting…" : reversalUnknown ? "Retry same reversal" : "Confirm reversal"}
                    </button>
                  </div>
                </>
              )}
            </section>
          )}
          {store.mode === "live" && store.role !== "TREASURY_ADMIN" && (
            <p className="muted">Read-only transfer inspection. Reversal is restricted to Treasury Admin.</p>
          )}
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
