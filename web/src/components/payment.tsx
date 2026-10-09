"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ApiError,
  Transfer,
  TransferRequest,
  TREASURY,
  cents,
  money,
  shortId,
  stamp,
} from "@/lib/domain";
import { useWorkspace, Icon } from "./workspace";
import { Copy, Empty, Modal, Notice, PageHeading } from "./ui";
import { useFeedback } from "./feedback";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
export function PaymentPage({ deposit = false }: { deposit?: boolean }) {
  const store = useWorkspace();
  const permitted = deposit ? store.permissions.deposit : store.permissions.transfer;
  const { notify } = useFeedback();
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
  const [receipt, setReceipt] = useState<Transfer | TransferRequest>();
  const [lab, setLab] = useState(false);
  const [unknown, setUnknown] = useState(false);
  type Pending = { email: string; sourceAccountId: string; targetAccountId: string; amount: string; description: string; idempotencyKey: string; deposit: boolean };
  const [pending, setPending] = useState<Pending>();
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const raw = sessionStorage.getItem("ledgerflow-pending-request");
        const saved = raw ? JSON.parse(raw) as Pending : null;
        if (saved && saved.email === store.sessionEmail && typeof saved.idempotencyKey === "string"
          && typeof saved.sourceAccountId === "string" && typeof saved.targetAccountId === "string"
          && typeof saved.amount === "string" && typeof saved.description === "string"
          && typeof saved.deposit === "boolean") setPending(saved);
      } catch { /* Browser storage can be unavailable. */ }
    });
    return () => cancelAnimationFrame(frame);
  }, [store.sessionEmail, deposit]);
  const submitting = useRef(false);
  const from = store.accounts.find((a) => a.id === source);
  const to = store.accounts.find((a) => a.id === target);
  const targetOptions = store.accounts
    .filter((a) => a.id !== TREASURY && a.id !== source)
    .map((a) => ({ value: a.id, label: a.name }));
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
    if (submitting.current || !permitted || (store.mode === "live" && pending)) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      if (store.mode === "live") sessionStorage.setItem("ledgerflow-pending-request", JSON.stringify({ email: store.sessionEmail, sourceAccountId: source, targetAccountId: target, amount, description: note, idempotencyKey: key, deposit }));
    } catch { /* Preserve the in-memory reference when browser storage is blocked. */ }
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
      if (store.mode === "live") {
        try { sessionStorage.removeItem("ledgerflow-pending-request"); } catch { /* Storage unavailable. */ }
        setPending(undefined);
      }
      setReceipt(result);
      setReview(false);
      setUnknown(false);
      const request = "requesterEmail" in result ? result : undefined;
      notify({
        type: "success",
        title: deposit ? "Allocation completed" : request ? request.status === "PENDING" ? "Approval requested" : `Request ${request.status.toLowerCase()}` : "Transfer completed",
        description: `${money(result.amount)} · ${shortId(result.id)}`,
      });
    } catch (e) {
      if (store.mode === "live" && e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 401) {
        try { sessionStorage.removeItem("ledgerflow-pending-request"); } catch { /* Storage unavailable. */ }
        setPending(undefined);
        setUnknown(false);
      }
      const message = (e as Error).message;
      setError(message);
      notify({
        type: "error",
        title: deposit ? "Allocation failed" : "Transfer failed",
        description: message,
      });
      if (
        store.mode === "live" &&
        (!(e instanceof ApiError) || e.status >= 500)
      )
        setUnknown(true);
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
            : "Submit ordinary transfers for approval before funds move."
        }
      />
      {pending && <Notice>
        Saved request reference <span className="mono">{pending.idempotencyKey}</span><Copy value={pending.idempotencyKey} />.
        Verify this request before retrying. {store.mode === "demo" ? "Switch to Local API to restore the original request." : pending.deposit !== deposit ? <Link href={pending.deposit ? "/treasury" : "/transfers"}>Open saved request</Link> : <button disabled={!permitted} onClick={() => {
          setSource(pending.sourceAccountId); setTarget(pending.targetAccountId); setAmount(pending.amount);
          setNote(pending.description); setKey(pending.idempotencyKey); setUnknown(true); setPending(undefined);
        }}>Restore original request</button>}
      </Notice>}
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
      {receipt && "requesterEmail" in receipt ? (
        <section className="completion panel">
          <span className={`status ${receipt.status === "APPROVED" ? "good" : ""}`}>
            {receipt.status === "PENDING" ? "PENDING APPROVAL" : receipt.status}
          </span>
          <h2>{receipt.status === "PENDING" ? "Approval requested" : receipt.status === "APPROVED" ? "Request approved" : "Request rejected"}</h2>
          <strong className="money-large">{money(receipt.amount)}</strong>
          <p className="muted">
            {receipt.status === "PENDING"
              ? "This request is waiting for review. No account balance or journal entry has changed."
              : receipt.status === "APPROVED"
                ? "An administrator approved this request. The completed transfer is linked below."
                : "This request was rejected. No funds moved."}
          </p>
          <dl className="detail-list completion-details">
            <dt>From</dt>
            <dd>{store.accounts.find((a) => a.id === receipt.sourceAccountId)?.name || shortId(receipt.sourceAccountId)}</dd>
            <dt>To</dt>
            <dd>{store.accounts.find((a) => a.id === receipt.targetAccountId)?.name || shortId(receipt.targetAccountId)}</dd>
            <dt>Request ID</dt>
            <dd className="mono">{receipt.id}<Copy value={receipt.id} /></dd>
            <dt>Reference</dt>
            <dd className="mono">{receipt.idempotencyKey}<Copy value={receipt.idempotencyKey} /></dd>
            <dt>Requested by</dt>
            <dd>{receipt.requesterEmail}</dd>
            <dt>Submitted</dt>
            <dd>{stamp(receipt.createdAt)}</dd>
            {receipt.decisionReason && <><dt>Decision note</dt><dd>{receipt.decisionReason}</dd></>}
          </dl>
          <div className="inline">
            <Link className="button" href={receipt.completedTransferId ? `/ledger?account=${receipt.sourceAccountId}&transaction=${receipt.completedTransferId}` : "/approvals"}>
              {receipt.completedTransferId ? "View completed transfer" : "View approvals"}
            </Link>
            <button onClick={reset}>New request</button>
          </div>
        </section>
      ) : receipt ? (
        <section className="completion panel">
          <span className="status good">
            {store.mode === "demo" ? "SIMULATION COMPLETED" : receipt.status}
          </span>
          <h2>{deposit ? "Allocation completed" : "Transfer completed"}</h2>
          <strong className="money-large">{money(receipt.amount)}</strong>
          <p className="muted">
            The server accepted the movement and revalidated both balances.
          </p>
          <dl className="detail-list completion-details">
            <dt>From</dt>
            <dd>
              {store.accounts.find((a) => a.id === receipt.sourceAccountId)
                ?.name || shortId(receipt.sourceAccountId)}
            </dd>
            <dt>To</dt>
            <dd>
              {store.accounts.find((a) => a.id === receipt.targetAccountId)
                ?.name || shortId(receipt.targetAccountId)}
            </dd>
            <dt>Transfer ID</dt>
            <dd className="mono">
              {receipt.id}
              <Copy value={receipt.id} />
            </dd>
            <dt>Reference</dt>
            <dd className="mono">
              {receipt.idempotencyKey}
              <Copy value={receipt.idempotencyKey} />
            </dd>
            <dt>Recorded</dt>
            <dd>{stamp(receipt.createdAt)}</dd>
          </dl>
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
      ) : lab ? (
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
          {!permitted && <Notice>Your signed-in role has read-only access to this operation.</Notice>}
          <div className="split-workspace">
            <section className="form-panel">
              <div className="section-heading">
                <h2>{deposit ? "Allocation details" : "Transfer details"}</h2>
                <span className="muted">01 / PREPARE</span>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (store.mode === "live" && pending) return;
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
                    const message = (e as Error).message;
                    setError(message);
                    notify({
                      type: "error",
                      title: "Check the transfer details",
                      description: message,
                    });
                  }
                }}
              >
                <fieldset disabled={busy || unknown || !!receipt || !permitted}>
                  {!deposit && (
                    <label>
                      Source account
                      <Select
                        items={store.accounts
                          .filter((a) => a.id !== TREASURY)
                          .map((a) => ({ value: a.id, label: a.name }))}
                        value={source}
                        onValueChange={(value) => setSource(value || "")}
                      >
                        <SelectTrigger aria-label="Source account">
                          <SelectValue placeholder="Select source account" />
                        </SelectTrigger>
                        <SelectContent className="ledgerflow-select">
                          <SelectGroup>
                            {store.accounts
                              .filter((a) => a.id !== TREASURY)
                              .map((a) => (
                                <SelectItem key={a.id} value={a.id}>
                                  {a.name}
                                </SelectItem>
                              ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <small>
                        {from
                          ? `Current balance: ${money(from.currentBalance)}`
                          : "Choose the account to debit."}
                      </small>
                    </label>
                  )}
                  <label>
                    {deposit ? "Target account" : "Destination account"}
                    <Combobox
                      items={targetOptions}
                      value={target}
                      inputValue={target}
                      onInputValueChange={setTarget}
                      onValueChange={(value) => setTarget(value || "")}
                    >
                      <ComboboxInput
                        aria-label={
                          deposit ? "Target account" : "Destination account"
                        }
                        placeholder="Paste account UUID or choose an account"
                      />
                      <ComboboxContent className="ledgerflow-select">
                        <ComboboxEmpty>No matching account.</ComboboxEmpty>
                        <ComboboxList>
                          {(item) => (
                            <ComboboxItem key={item.value} value={item.value}>
                              {item.label}
                            </ComboboxItem>
                          )}
                        </ComboboxList>
                      </ComboboxContent>
                    </Combobox>
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
                      : deposit ? "Development database write" : "Submits for approval · no funds move yet"}
                  </span>
                  <button
                    className="primary"
                    disabled={busy || unknown || !!receipt || store.loading || !permitted || (store.mode === "live" && !!pending)}
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
                      <span>{store.mode === "live" && !deposit ? "After approval" : "After"}</span>
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
              : deposit
                ? "Confirm this treasury allocation to your local development database."
                : "This submits an approval request to your local API. Account balances and journal entries stay unchanged until an administrator approves it."}
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
                : deposit
                  ? "Confirm allocation"
                  : store.mode === "live"
                    ? "Submit for approval"
                    : "Confirm transfer"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
