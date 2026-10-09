"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Copy, LogOut, Wallet as WalletIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { money, shortId, WalletSessionUser } from "@/lib/domain";
import { canReleaseWalletRequestKey } from "@/lib/wallet-operations";

type WalletAccount = { id: string; name: string; balance: string; frozen?: boolean };
type Recipient = { id: string; name: string };
type Entry = { id: string; transferId: string; direction: "DEBIT" | "CREDIT"; amount: string; createdAt: string };
type Page = { content: Entry[]; page: number; size: number; totalPages: number; totalElements: number; hasNext: boolean };
type PendingOperation = { key: string; fingerprint: string };
const opStorage = (customerId: string) => `ledgerflow-wallet-pending-v1:${customerId}`;

function readPendingOperations(raw: string | null): Record<string, PendingOperation> {
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid saved request data.");
  const operations = parsed as Record<string, unknown>;
  const result: Record<string, PendingOperation> = {};
  for (const [slot, value] of Object.entries(operations)) {
    if (!["topup", "transfer"].includes(slot) || !value || typeof value !== "object") throw new Error("Invalid saved request data.");
    const operation = value as Record<string, unknown>;
    if (typeof operation.key !== "string" || !operation.key || typeof operation.fingerprint !== "string") throw new Error("Invalid saved request data.");
    const payload: unknown = JSON.parse(operation.fingerprint);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Invalid saved request data.");
    result[slot] = { key: operation.key, fingerprint: operation.fingerprint };
  }
  return result;
}

class WalletApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function request<T>(path: string, body?: object): Promise<T> {
  const response = await fetch(`/api/wallet/${path}`, { method: body ? "POST" : "GET", headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
  const result = await response.json();
  if (response.status === 401 && typeof window !== "undefined") {
    window.dispatchEvent(new Event("ledgerflow-wallet-session-expired"));
  }
  if (!response.ok) throw new WalletApiError(result.message || "Wallet request failed. Try again.", response.status);
  return result as T;
}

export function WalletAuth({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const register = mode === "register";

  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    if (register && password !== confirm) { setError("Passwords do not match."); return; }
    setPending(true);
    try {
      const response = await fetch(`/api/wallet/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const result = await response.json() as { user?: WalletSessionUser; message?: string };
      if (!response.ok) throw new Error(result.message || "Unable to continue.");
      if (result.user?.role !== "CUSTOMER") throw new Error("Customer wallet access is required.");
      if (register) setDone(true); else { router.replace("/wallet"); router.refresh(); }
    } catch (e) { setError(e instanceof Error ? e.message : "Wallet service is unavailable."); }
    finally { setPending(false); }
  }
  return (
    <main className="wallet-auth">
      <header className="wallet-brand">
        <Link href="/wallet"><span className="wallet-brand-icon"><WalletIcon size={18} /></span> LedgerFlow Wallet</Link>
        <span>SIMULATED FUNDS</span>
      </header>
      <div className="wallet-auth-layout">
        <section className="wallet-introduction" aria-labelledby="wallet-introduction-title">
          <div className="wallet-intro-symbol" aria-hidden="true"><WalletIcon size={30} /></div>
          <div className="wallet-eyebrow">A SIMPLE WAY TO SIMULATE</div>
          <h2 id="wallet-introduction-title">Your wallet.<br /> One clear view.</h2>
          <p>Keep track of your balance, send to another wallet, and follow every movement.</p>
          <ul className="wallet-intro-features">
            <li><ArrowDownLeft size={18} aria-hidden="true" /><div><strong>Add a simulated balance</strong><span>Start with zero and try a top up.</span></div></li>
            <li><ArrowLeftRight size={18} aria-hidden="true" /><div><strong>Send with confidence</strong><span>Confirm the recipient before transferring.</span></div></li>
            <li><ArrowUpRight size={18} aria-hidden="true" /><div><strong>Follow your activity</strong><span>See incoming and outgoing movements.</span></div></li>
          </ul>
          <div className="wallet-intro-note">A payment simulation. No real money involved.</div>
        </section>
      <section className="wallet-auth-card">
        <div className="wallet-eyebrow">PERSONAL WALLET</div>
        <h1>{done ? "Wallet created" : register ? "Create your wallet" : "Welcome back"}</h1>
        <p>{done ? "Your wallet is ready with a zero balance. Sign in to continue." : register ? "Set up a personal wallet for simulated transfers." : "Sign in to view your balance and activity."}</p>
        {done ? (
          <Link className="wallet-primary wallet-link-button" href="/wallet/login">Continue to sign in</Link>
        ) : (
          <form onSubmit={submit} className="wallet-form">
            <div className="wallet-field">
              <label htmlFor="wallet-email">Email address</label>
              <Input id="wallet-email" autoComplete="email" disabled={pending} onChange={event => setEmail(event.target.value)} required type="email" value={email} />
            </div>
            <div className="wallet-field">
              <label htmlFor="wallet-password">Password</label>
              <Input id="wallet-password" aria-describedby={register ? "wallet-password-hint" : undefined} autoComplete={register ? "new-password" : "current-password"} disabled={pending} minLength={12} onChange={event => setPassword(event.target.value)} required type="password" value={password} />
              {register && <small id="wallet-password-hint">Use at least 12 characters.</small>}
            </div>
            {register && (
              <div className="wallet-field">
                <label htmlFor="wallet-confirm-password">Confirm password</label>
                <Input id="wallet-confirm-password" autoComplete="new-password" disabled={pending} onChange={event => setConfirm(event.target.value)} required type="password" value={confirm} />
              </div>
            )}
            {error && <p className="wallet-error" role="alert">{error}</p>}
            <Button className="wallet-primary" disabled={pending} type="submit">{pending ? "Please wait…" : register ? "Create wallet" : "Sign in"}</Button>
          </form>
        )}
        {!done && <div className="wallet-auth-switch">{register ? "Already have a wallet?" : "New to LedgerFlow?"} <Link href={register ? "/wallet/login" : "/wallet/register"}>{register ? "Sign in" : "Create one"}</Link></div>}
        <div className="wallet-auth-switch">Staff member? <Link href="/auth/login">Operations sign in</Link></div>
        <div className="wallet-sim-note">All balances and transfers in this experience are simulated.</div>
      </section>
      </div>
    </main>
  );
}

export function WalletHome() {
  const router = useRouter();
  const [account, setAccount] = useState<WalletAccount | null>(null);
  const [history, setHistory] = useState<Page | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [page, setPage] = useState(0);
  const [topupAmount, setTopupAmount] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [transferAmount, setTransferAmount] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [pendingOps, setPendingOps] = useState<Record<string, PendingOperation>>({});
  const [pendingStorageReady, setPendingStorageReady] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onExpired = () => {
      router.replace("/wallet/login");
      router.refresh();
    };
    window.addEventListener("ledgerflow-wallet-session-expired", onExpired);
    return () => window.removeEventListener("ledgerflow-wallet-session-expired", onExpired);
  }, [router]);

  async function refresh() {
    const me = await request<WalletAccount>("me");
    setAccount(me);
    try {
      const operations = readPendingOperations(localStorage.getItem(opStorage(me.id)));
      setPendingOps(operations);
      if (operations.topup) setTopupAmount((JSON.parse(operations.topup.fingerprint) as { amount: string }).amount);
      if (operations.transfer) {
        const transfer = JSON.parse(operations.transfer.fingerprint) as { targetAccountId: string; amount: string };
        setRecipientId(transfer.targetAccountId); setTransferAmount(transfer.amount);
        request<Recipient>(`recipient/${encodeURIComponent(transfer.targetAccountId)}`).then(setRecipient).catch(()=>{});
      }
      setPendingStorageReady(true);
    } catch {
      setError("A saved pending request could not be read. Wallet actions are paused to protect your balance.");
    }
    try {
      const entries = await request<Page>(`history?page=${page}&size=10`);
      setHistory(entries); setHistoryError(""); setHistoryLoading(false);
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : "Activity could not be loaded.");
      setHistoryLoading(false);
    }
  }
  useEffect(() => {
    let active = true;
    request<WalletAccount>("me").then(me => {
      if (!active) return;
      setAccount(me);
      try {
        const operations = readPendingOperations(localStorage.getItem(opStorage(me.id)));
        setPendingOps(operations);
        if (operations.topup) setTopupAmount((JSON.parse(operations.topup.fingerprint) as { amount: string }).amount);
        if (operations.transfer) {
          const transfer = JSON.parse(operations.transfer.fingerprint) as { targetAccountId: string; amount: string };
          setRecipientId(transfer.targetAccountId); setTransferAmount(transfer.amount);
          request<Recipient>(`recipient/${encodeURIComponent(transfer.targetAccountId)}`).then(value => { if (active) setRecipient(value); }).catch(() => {});
        }
        setPendingStorageReady(true);
      } catch { setError("A saved pending request could not be read. Wallet actions are paused to protect your balance."); }
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : "Unable to load wallet."); });
    request<Page>(`history?page=${page}&size=10`).then(entries => {
      if (active) { setHistory(entries); setHistoryError(""); setHistoryLoading(false); }
    }).catch(e => {
      if (active) { setHistoryError(e instanceof Error ? e.message : "Activity could not be loaded."); setHistoryLoading(false); }
    });
    return () => { active = false; };
  }, [page]);

  function operation(slot: string, payload: object): PendingOperation {
    const fingerprint = JSON.stringify(payload);
    const existing = pendingOps[slot];
    if (existing && existing.fingerprint !== fingerprint) throw new Error("A previous request has an unknown outcome. Retry its original details before changing them.");
    const selected = existing || { key: crypto.randomUUID(), fingerprint };
    const updated = { ...pendingOps, [slot]: selected };
    if (!account || !pendingStorageReady) throw new Error("Wallet details and any pending request are still loading.");
    try { localStorage.setItem(opStorage(account.id), JSON.stringify(updated)); }
    catch { throw new Error("This browser cannot save a retry reference, so the wallet request was cancelled before sending."); }
    setPendingOps(updated);
    return selected;
  }
  function clearOperation(slot: string) {
    const updated = { ...pendingOps }; delete updated[slot];
    setPendingOps(updated);
    try { if (account) localStorage.setItem(opStorage(account.id), JSON.stringify(updated)); } catch { setError("The operation completed, but this browser could not clear its saved retry reference."); }
  }
  function rejectKnownOperation(slot: string, cause: unknown) {
    if (cause instanceof WalletApiError && canReleaseWalletRequestKey(cause.status)) clearOperation(slot);
  }
  async function topup(event: FormEvent) {
    event.preventDefault(); setError(""); setNotice(""); setPending(true);
    try { const payload = { amount: topupAmount, description: "Customer simulator top up" }; const op = operation("topup", payload); await request("topups", { ...payload, idempotencyKey: op.key }); clearOperation("topup"); setTopupAmount(""); setNotice("Simulated top up added to your wallet."); refresh().catch(()=>setError("Top up completed, but the balance could not be refreshed. Reload the wallet to check it.")); }
    catch(e) { rejectKnownOperation("topup", e); setError(e instanceof Error ? e.message : "Top up outcome is unknown. Retry the same request or check history."); }
    finally { setPending(false); }
  }
  async function lookup(event: FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    setRecipient(null);
    setPending(true);
    try {
      const found = await request<Recipient>(`recipient/${encodeURIComponent(recipientId.trim())}`);
      setRecipient(found);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Recipient could not be found.");
    } finally {
      setPending(false);
    }
  }

  async function transfer(event: FormEvent) {
    event.preventDefault();
    if (!recipient) return;
    setError("");
    setNotice("");
    setPending(true);
    try {
      const payload = { targetAccountId: recipient.id, amount: transferAmount, description: "Wallet transfer" };
      const op = operation("transfer", payload);
      await request("transfers", { ...payload, idempotencyKey: op.key });
      clearOperation("transfer");
      setTransferAmount("");
      setRecipientId("");
      setRecipient(null);
      setNotice("Transfer completed.");
      refresh().catch(() => setError("Transfer completed, but the balance could not be refreshed. Reload the wallet to check it."));
    } catch (cause) {
      rejectKnownOperation("transfer", cause);
      setError(cause instanceof Error ? cause.message : "Transfer outcome is unknown. Retry the same request or check history.");
    } finally {
      setPending(false);
    }
  }
  async function logout() {
    await fetch("/api/wallet/auth/logout", { method: "POST" });
    router.replace("/wallet/login");
    router.refresh();
  }

  async function copyId() {
    if (!account) return;
    await navigator.clipboard.writeText(account.id);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <main className="wallet-page">
      <header className="wallet-nav">
        <Link href="/wallet" className="wallet-brand-name">
          <span className="wallet-brand-icon"><WalletIcon size={18} /></span> LedgerFlow Wallet
        </Link>
        <div>
          <span className="wallet-pill">SIMULATED FUNDS</span>
          <button className="wallet-logout" onClick={logout}><LogOut size={15} /> Sign out</button>
        </div>
      </header>
      <div className="wallet-content">
        <div className="wallet-page-heading">
          <div>
            <div className="wallet-eyebrow">YOUR WALLET</div>
            <h1>Good to see you</h1>
            <p>Manage your simulated balance and transfers.</p>
          </div>
        </div>
        <div className="wallet-overview">
        <section className="wallet-balance-card" aria-label="Wallet balance">
          <div className="wallet-balance-top">
            <span>Available balance</span>
            <span className="wallet-pill wallet-pill-light">SIMULATED</span>
          </div>
          <strong className={account && money(account.balance).length > 22 ? "wallet-large-balance" : undefined}>{account ? money(account.balance) : "Loading…"}</strong>
          <div className="wallet-balance-caption"><span className="wallet-status-dot" aria-hidden="true" />{account ? account.frozen ? "Wallet frozen" : "Ready for simulated transfers" : "Connecting to your wallet"}</div>
        </section>
        <section className="wallet-reference" aria-label="Your wallet ID">
          <div className="wallet-eyebrow">RECEIVE A TRANSFER</div>
          <h2>Your wallet ID</h2>
          <p>Share this ID with another wallet user.</p>
          <code>{account ? account.id : "Loading wallet ID…"}</code>
          <div className="wallet-id-row">
            <span>For simulated transfers</span>
            <button aria-label="Copy full wallet ID" className="wallet-copy" disabled={!account} onClick={copyId}>
              <Copy size={14} />{copied ? "Copied" : "Copy ID"}
            </button>
          </div>
        </section>
        </div>
        {account?.frozen && <p className="wallet-error wallet-banner" role="status">This wallet is frozen. Top ups and transfers are unavailable.</p>}
        {error && <p className="wallet-error wallet-banner" role="alert">{error}</p>}
        {notice && <p className="wallet-success wallet-banner" role="status">{notice}</p>}
      <div className="wallet-action-grid">
        <section className="wallet-panel">
          <div className="wallet-panel-heading">
            <span className="wallet-action-icon topup-icon"><ArrowDownLeft size={18} /></span>
            <div><h2>Top up</h2><p>Add simulated funds</p></div>
          </div>
          <form className="wallet-form" onSubmit={topup}>
            <div className="wallet-field">
              <label htmlFor="wallet-topup-amount">Amount (Rp)</label>
              <Input id="wallet-topup-amount" disabled={pending || !account || !pendingStorageReady || account.frozen || Boolean(pendingOps.topup)} inputMode="decimal" min="0.01" onChange={event => setTopupAmount(event.target.value)} placeholder="0.00" required step="0.01" type="number" value={topupAmount} />
            </div>
            {pendingOps.topup && <small>An earlier request is unresolved. Retry the same amount: Rp {(JSON.parse(pendingOps.topup.fingerprint) as { amount: string }).amount}.</small>}
            <Button disabled={pending || !account || !pendingStorageReady || account.frozen || !topupAmount} type="submit">{pending ? "Processing…" : "Add simulated funds"}</Button>
          </form>
          <small className="wallet-disclaimer">No real payment is processed. Top ups are for demonstration only.</small>
        </section>
        <section className="wallet-panel">
          <div className="wallet-panel-heading">
            <span className="wallet-action-icon transfer-icon"><ArrowLeftRight size={18} /></span>
            <div><h2>Send money</h2><p>Transfer to another wallet</p></div>
          </div>
          <form className="wallet-form" onSubmit={recipient ? transfer : lookup}>
            <div className="wallet-field">
              <label htmlFor="wallet-recipient-id">Recipient wallet ID</label>
              <Input id="wallet-recipient-id" autoComplete="off" disabled={pending || !account || !pendingStorageReady || account.frozen || Boolean(pendingOps.transfer)} onChange={event => { setRecipientId(event.target.value); setRecipient(null); }} placeholder="Paste wallet ID" required value={recipientId} />
            </div>
            {recipient && <div className="wallet-recipient"><span>Sending to</span><strong>{recipient.name}</strong><small>{shortId(recipient.id)}</small></div>}
            {recipient && (
              <div className="wallet-field">
                <label htmlFor="wallet-transfer-amount">Amount (Rp)</label>
                <Input id="wallet-transfer-amount" disabled={pending || !pendingStorageReady || account?.frozen || Boolean(pendingOps.transfer)} inputMode="decimal" min="0.01" onChange={event => setTransferAmount(event.target.value)} placeholder="0.00" required step="0.01" type="number" value={transferAmount} />
              </div>
            )}
            {pendingOps.transfer && <small>An earlier request is unresolved. Retry the original transfer details before editing.</small>}
            <Button disabled={pending || !account || !pendingStorageReady || account.frozen || (recipient ? !transferAmount : !recipientId)} type="submit">{pending ? "Processing…" : recipient ? "Confirm transfer" : "Find recipient"}</Button>
            {recipient && <button className="wallet-text-button" disabled={pending} onClick={() => setRecipient(null)} type="button">Change recipient</button>}
          </form>
          <small className="wallet-disclaimer">Confirm the recipient name before sending. Transfers settle immediately.</small>
        </section>
      </div>
        <section className="wallet-panel wallet-history">
          <div className="wallet-history-heading">
            <div><h2>Recent activity</h2><p>Your personal wallet history</p></div>
            <span>{history?.totalElements ?? 0} {history?.totalElements === 1 ? "transaction" : "transactions"}</span>
          </div>
          {historyLoading ? (
            <div className="wallet-empty">Loading activity…</div>
          ) : historyError ? (
            <div className="wallet-error" role="alert">Activity could not be loaded: {historyError}</div>
          ) : !history?.content.length ? (
            <div className="wallet-empty"><span className="wallet-empty-icon" aria-hidden="true"><ArrowLeftRight size={24} /></span><strong>Your first movement starts here</strong><p>Try a simulated top up, then send to another wallet. Your activity will appear here.</p></div>
          ) : (
            <div className="wallet-entries">
              {history.content.map(entry => (
                <div className="wallet-entry" key={entry.id}>
                  <span className={`wallet-entry-icon ${entry.direction === "CREDIT" ? "credit" : "debit"}`}>
                    {entry.direction === "CREDIT" ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}
                  </span>
                  <div className="wallet-entry-main">
                    <strong>{entry.direction === "CREDIT" ? "Money received" : "Money sent"}</strong>
                    <small>{new Date(entry.createdAt).toLocaleString("en-GB", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" })} · {shortId(entry.transferId)}</small>
                  </div>
                  <b className={entry.direction === "CREDIT" ? "wallet-credit" : ""}>{entry.direction === "CREDIT" ? "+" : "−"}{money(entry.amount)}</b>
                </div>
              ))}
            </div>
          )}
          <div className="wallet-pagination">
            <span>Page {history ? history.page + 1 : page + 1} of {Math.max(1, history?.totalPages ?? 1)}</span>
            <div>
              <Button disabled={page === 0 || pending} onClick={() => { setHistoryLoading(true); setHistoryError(""); setPage(current => Math.max(0, current - 1)); }} type="button" variant="outline">Previous</Button>
              <Button disabled={!history?.hasNext || pending} onClick={() => { setHistoryLoading(true); setHistoryError(""); setPage(current => current + 1); }} type="button" variant="outline">Next</Button>
            </div>
          </div>
        </section>
        <footer className="wallet-footer">Balances and transactions are simulated for demonstration purposes.</footer>
      </div>
    </main>
  );
}
