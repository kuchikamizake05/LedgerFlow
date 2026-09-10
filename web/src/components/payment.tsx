"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { Transfer, TREASURY, cents, money, shortId, stamp } from "@/lib/domain";
import { useWorkspace, Icon } from "./workspace";
import { Copy, Empty, Modal, Notice, PageHeading } from "./ui";
export function PaymentPage({ deposit = false }: { deposit?: boolean }) {
  const store = useWorkspace();
  const params = useSearchParams();
  const [source, setSource] = useState(
    deposit ? TREASURY : params.get("account") || "",
  );
  const [target, setTarget] = useState(
    deposit ? params.get("account") || "" : "",
  );
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<Transfer>();
  const [lab, setLab] = useState(false);
  const [unknown, setUnknown] = useState(false);
  const submitting = useRef(false);
  const from = store.accounts.find((a) => a.id === source);
  const to = store.accounts.find((a) => a.id === target);
  let parsed = BigInt(0);
  try {
    parsed = cents(amount);
  } catch {
    /* Incomplete input is not a valid preview. */
  }
  function reset() {
    setUnknown(false);
    setReceipt(undefined);
    setKey("");
    setAmount("");
    setNote("");
    setError("");
  }
  async function confirm() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await store.transfer(
        {
          sourceAccountId: source,
          targetAccountId: target,
          amount,
          idempotencyKey: key,
          description: note,
        },
        deposit,
      );
      setReceipt(result);
      setReview(false);
      setUnknown(false);
    } catch (e) {
      setError((e as Error).message);
      if (store.mode === "live") setUnknown(true);
    } finally {
      setBusy(false);
      submitting.current = false;
    }
  }
  const title = deposit ? "Treasury" : "Transfers";
  return (
    <>
      <PageHeading
        title={title}
        description={
          deposit
            ? "Allocate treasury funds to an account."
            : "Move funds between accounts. Every movement has a trace."
        }
      />
      {!deposit && (
        <div className="tabs">
          <button
            className={!lab ? "active" : ""}
            onClick={() => setLab(false)}
          >
            New transfer
          </button>
          <button className={lab ? "active" : ""} onClick={() => setLab(true)}>
            Concurrency lab <span className="badge">SANDBOX</span>
          </button>
        </div>
      )}
      {lab ? (
        <section className="panel">
          <Empty title="Concurrency lab — not enabled">
            This screen is reserved for isolated test accounts. No load test or
            real payment is executed here.
          </Empty>
          <Notice>
            The backend has no dedicated simulation endpoint. Use the transfer
            workflow to test individual operations; concurrent load requires a
            separately reviewed test harness.
          </Notice>
        </section>
      ) : (
        <>
          {deposit && (
            <section className="treasury-strip">
              <div className="inline">
                <div className="icon-box">
                  <Icon name="treasury" />
                </div>
                <div>
                  <strong>System Treasury</strong>
                  <div className="mono muted">
                    {shortId(TREASURY)}
                    <Copy value={TREASURY} />
                  </div>
                </div>
              </div>
              <div>
                <small>CURRENT BALANCE</small>
                <strong className="money-large">
                  {from ? money(from.currentBalance) : "Unavailable"}
                </strong>
                <small>
                  {store.checked
                    ? stamp(store.checked)
                    : "Demo session balance"}
                </small>
              </div>
            </section>
          )}
          {store.error && <Notice danger>{store.error}</Notice>}
          <div className="split-workspace">
            <section className="form-panel">
              <div className="section-heading">
                <h2>{deposit ? "Allocation details" : "Transfer details"}</h2>
                <span className="muted">01 / PREPARE</span>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setError("");
                  try {
                    if (!from || !to)
                      throw new Error(
                        "Select valid source and destination accounts.",
                      );
                    if (source === target)
                      throw new Error(
                        "Source and destination must be different.",
                      );
                    const n = cents(amount);
                    if (n <= BigInt(0))
                      throw new Error("Amount must be greater than zero.");
                    if (n > cents(from.currentBalance))
                      throw new Error("Insufficient source balance.");
                    if (!key) setKey(crypto.randomUUID());
                    setReview(true);
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                <fieldset disabled={busy || unknown || !!receipt}>
                  {!deposit && (
                    <label>
                      Source account
                      <select
                        required
                        value={source}
                        onChange={(e) => setSource(e.target.value)}
                      >
                        <option value="">Select source account</option>
                        {store.accounts
                          .filter((a) => a.id !== TREASURY)
                          .map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                      </select>
                      <small>
                        {from
                          ? `Current balance: ${money(from.currentBalance)}`
                          : "Choose the account to debit."}
                      </small>
                    </label>
                  )}
                  <label>
                    {deposit ? "Target account" : "Destination account"}
                    <input
                      list="target-accounts"
                      required
                      placeholder="Paste account UUID or choose an account"
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                    />
                    <datalist id="target-accounts">
                      {store.accounts
                        .filter((a) => a.id !== TREASURY && a.id !== source)
                        .map((a) => (
                          <option value={a.id} key={a.id}>
                            {a.name}
                          </option>
                        ))}
                    </datalist>
                    <small>
                      {to
                        ? `${to.name} · ${money(to.currentBalance)}`
                        : "Account name appears after selecting a valid UUID."}
                    </small>
                  </label>
                  <label>
                    {deposit ? "Allocation amount" : "Amount"}
                    <div className="amount-input">
                      <span>IDR</span>
                      <input
                        aria-label="Amount in IDR"
                        required
                        inputMode="decimal"
                        pattern="[0-9]+(\.[0-9]{1,2})?"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                    </div>
                    <small>
                      Use a period for decimals, without thousands separators.
                    </small>
                  </label>
                  {deposit && (
                    <div className="presets">
                      {["1000000", "5000000", "20000000"].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setAmount(n)}
                        >
                          {money(n)}
                        </button>
                      ))}
                    </div>
                  )}
                  <label>
                    {deposit ? "Reason / audit note" : "Note (optional)"}
                    <textarea
                      required={deposit}
                      maxLength={255}
                      placeholder="Add context for this movement…"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                    <small>{note.length}/255 characters</small>
                  </label>
                  <details className="advanced">
                    <summary>Advanced · Request reference</summary>
                    <label>
                      Idempotency key
                      <input
                        value={key}
                        maxLength={100}
                        onChange={(e) => setKey(e.target.value)}
                        placeholder="Generated when you review"
                      />
                    </label>
                    <p className="muted">
                      Retain the same reference when retrying an unchanged
                      request.
                    </p>
                  </details>
                </fieldset>
                {error && <Notice danger>{error}</Notice>}
                <div className="form-actions">
                  <span className="muted">
                    {store.mode === "demo"
                      ? "Simulated movement only"
                      : "Development database write"}
                  </span>
                  <button
                    className="primary"
                    disabled={busy || unknown || !!receipt || store.loading}
                  >
                    Review {deposit ? "allocation" : "transfer"}
                    <Icon name="arrow" />
                  </button>
                </div>
              </form>
            </section>
            <aside className="preview">
              <div className="section-heading">
                <h2>Balance preview</h2>
                <span className="badge">ESTIMATE</span>
              </div>
              {[
                ["SOURCE", from, -parsed],
                ["DESTINATION", to, parsed],
              ].map(([label, account, delta]) => {
                const a = account as typeof from;
                return (
                  <div className="balance-block" key={label as string}>
                    <small>{label as string}</small>
                    <h3>{a?.name || "No account selected"}</h3>
                    <div className="balance-row">
                      <span>Before</span>
                      <span>{a ? money(a.currentBalance) : "—"}</span>
                    </div>
                    <div className="balance-row after">
                      <span>After</span>
                      <strong>
                        {a && amount
                          ? money(cents(a.currentBalance) + (delta as bigint))
                          : "—"}
                      </strong>
                    </div>
                  </div>
                );
              })}
              <p className="muted caption">
                Estimates only. Balances are revalidated by the server on
                submission.
              </p>
              <details className="advanced">
                <summary>Journal preview</summary>
                <p>
                  LedgerFlow records a DEBIT on the source and a CREDIT on the
                  destination.
                </p>
                <div className="balance-row">
                  <span>Each posting</span>
                  <strong>
                    {amount && parsed > BigInt(0) ? money(parsed) : "—"}
                  </strong>
                </div>
              </details>
              <details className="advanced">
                <summary>Engine diagnostics</summary>
                <p className="muted">
                  Row locking and idempotency are backend concerns. Runtime
                  verification is not exposed by this API.
                </p>
                <span className="badge">NOT CHECKED</span>
              </details>
            </aside>
          </div>
          {unknown && (
            <Notice danger>
              Outcome not confirmed. Keep reference{" "}
              <span className="mono">{key}</span>
              <Copy value={key} /> The form is locked to preserve the original
              payload. Check the ledger before retrying.{" "}
              <button disabled={busy} onClick={() => void confirm()}>
                Retry unchanged request
              </button>
            </Notice>
          )}
          {receipt && (
            <section className="receipt panel">
              <span className="status good">
                {store.mode === "demo"
                  ? "Simulation completed"
                  : receipt.status}
              </span>
              <h2>{deposit ? "Allocation" : "Transfer"} receipt</h2>
              <strong className="money-large">{money(receipt.amount)}</strong>
              <p className="mono">
                {receipt.id}
                <Copy value={receipt.id} />
              </p>
              <p>{stamp(receipt.createdAt)}</p>
              <div className="inline">
                <Link
                  className="button"
                  href={`/ledger?account=${receipt.sourceAccountId}&transaction=${receipt.id}`}
                >
                  View journal
                </Link>
                <button onClick={reset}>New operation</button>
              </div>
            </section>
          )}
          {deposit && (
            <section className="panel recent">
              <div className="section-heading">
                <h2>Recent allocations</h2>
                <span className="muted">
                  {store.mode === "demo"
                    ? "This demo session"
                    : "Read treasury statement"}
                </span>
              </div>
              {store.mode === "live" ? (
                <Empty title="Allocation history is in the treasury statement">
                  <Link href={`/ledger?account=${TREASURY}`}>
                    Open treasury statement →
                  </Link>
                </Empty>
              ) : store.transfers.filter((t) => t.sourceAccountId === TREASURY)
                  .length ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Timestamp</th>
                        <th>Target account</th>
                        <th className="number">Amount</th>
                        <th>Reference</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {store.transfers
                        .filter((t) => t.sourceAccountId === TREASURY)
                        .map((t) => (
                          <tr key={t.id}>
                            <td>{stamp(t.createdAt)}</td>
                            <td>
                              {
                                store.accounts.find(
                                  (a) => a.id === t.targetAccountId,
                                )?.name
                              }
                            </td>
                            <td className="number">{money(t.amount)}</td>
                            <td>
                              {shortId(t.idempotencyKey)}
                              <Copy value={t.idempotencyKey} />
                            </td>
                            <td>{t.status}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty title="No allocations this session">
                  Completed demo allocations appear here.
                </Empty>
              )}
            </section>
          )}
        </>
      )}
      {review && (
        <Modal
          title={`Review ${deposit ? "allocation" : "transfer"}`}
          onClose={() => {
            if (!busy) setReview(false);
          }}
        >
          <p className="muted">
            {store.mode === "demo"
              ? "This updates synthetic session data only."
              : "Confirm this write to your local development database."}
          </p>
          <dl className="detail-list">
            <dt>From</dt>
            <dd>{from?.name}</dd>
            <dt>To</dt>
            <dd>{to?.name}</dd>
            <dt>Amount</dt>
            <dd>{money(amount)}</dd>
            <dt>Note</dt>
            <dd>{note || "—"}</dd>
            <dt>Reference</dt>
            <dd className="mono">
              {key}
              <Copy value={key} />
            </dd>
          </dl>
          {error && <Notice danger>{error}</Notice>}
          <div className="form-actions">
            <button disabled={busy} onClick={() => setReview(false)}>
              Back
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={() => void confirm()}
            >
              {busy
                ? "Submitting…"
                : "Confirm " + (deposit ? "allocation" : "transfer")}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
