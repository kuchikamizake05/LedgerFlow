"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ApiError, PageResponse, TransferRequest, api, money, shortId, stamp } from "@/lib/domain";
import { useWorkspace } from "./workspace";
import { Empty, Notice, PageHeading } from "./ui";

type StatusFilter = "ALL" | TransferRequest["status"];
type PendingDecision = { action: "approve" | "reject"; reason: string };

function decisionKey(email: string | null, requestId: string) {
  return `ledgerflow-pending-approval:${email?.trim().toLowerCase() || "unknown"}:${requestId}`;
}

export function ApprovalsPage() {
  const store = useWorkspace();
  const [items, setItems] = useState<TransferRequest[]>([]);
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState<StatusFilter>("PENDING");
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const [selected, setSelected] = useState<TransferRequest>();
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [queueStale, setQueueStale] = useState(false);
  const [pendingDecision, setPendingDecision] = useState<PendingDecision>();
  const queueRequest = useRef(0);
  const detailRequest = useRef(0);

  const loadQueue = useCallback(async () => {
    if (store.mode !== "live") return;
    const requestNumber = ++queueRequest.current;
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ page: String(page), size: "10" });
      if (status !== "ALL") query.set("status", status);
      const result = await api<PageResponse<TransferRequest>>(`transfer-requests?${query}`);
      if (requestNumber !== queueRequest.current) return;
      setItems(result.content);
      setTotalElements(result.totalElements);
      setTotalPages(result.totalPages);
      setQueueStale(false);
      if (!result.content.some((item) => item.id === selectedId)) {
        setSelectedId("");
        setSelected(undefined);
      }
    } catch (cause) {
      if (requestNumber !== queueRequest.current) return;
      setQueueStale(true);
      setError((cause as Error).message);
    } finally {
      if (requestNumber === queueRequest.current) setLoading(false);
    }
  }, [page, selectedId, status, store.mode]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadQueue(), 0);
    return () => window.clearTimeout(timer);
  }, [loadQueue]);

  async function selectRequest(id: string) {
    const requestNumber = ++detailRequest.current;
    setSelectedId(id);
    setSelected(undefined);
    setReason("");
    setPendingDecision(undefined);
    setError("");
    try {
      const request = await api<TransferRequest>(`transfer-requests/${id}`);
      if (requestNumber !== detailRequest.current) return;
      setSelected(request);
      try {
        const raw = localStorage.getItem(decisionKey(store.sessionEmail, id));
        if (request.status !== "PENDING") {
          setPendingDecision(undefined);
          setReason("");
          try { localStorage.removeItem(decisionKey(store.sessionEmail, id)); } catch { /* The terminal server state remains authoritative. */ }
        } else if (raw) {
          const saved = JSON.parse(raw) as PendingDecision;
          if ((saved.action === "approve" || saved.action === "reject") && typeof saved.reason === "string" && saved.reason.length > 0 && saved.reason.length <= 255) {
            setPendingDecision(saved);
            setReason(saved.reason);
          }
        }
      } catch {
        setError("A saved decision could not be read. Refresh this request before deciding again.");
      }
    } catch (cause) {
      if (requestNumber !== detailRequest.current) return;
      setError((cause as Error).message);
    }
  }

  async function decide(action: "approve" | "reject") {
    if (!selected || !canDecide || !reason.trim() || reason.length > 255 || busy) return;
    const actionToSend = pendingDecision?.action ?? action;
    const reasonToSend = pendingDecision?.reason ?? reason.trim();
    if (pendingDecision && action !== pendingDecision.action) return;
    setBusy(true);
    setError("");
    let submitted = false;
    try {
      const key = decisionKey(store.sessionEmail, selected.id);
      if (!pendingDecision) {
        try {
          localStorage.setItem(key, JSON.stringify({ action: actionToSend, reason: reasonToSend } satisfies PendingDecision));
        } catch {
          throw new Error("This browser cannot save a safe decision retry. Enable local storage before deciding.");
        }
      }
      submitted = true;
      const updated = await api<TransferRequest>(`transfer-requests/${selected.id}/${actionToSend}`, { reason: reasonToSend });
      try { localStorage.removeItem(key); } catch { /* A later detail fetch can clear this saved retry after the server confirms the terminal state. */ }
      setPendingDecision(undefined);
      setSelected(updated);
      setReason("");
      await Promise.all([
        loadQueue(),
        updated.status === "APPROVED" ? store.refresh() : Promise.resolve(),
      ]);
    } catch (cause) {
      const message = cause instanceof ApiError ? cause.message : (cause as Error).message;
      if (submitted && (!(cause instanceof ApiError) || cause.status >= 500 || cause.status === 401)) {
        setPendingDecision({ action: actionToSend, reason: reasonToSend });
      } else if (submitted) {
        try { localStorage.removeItem(decisionKey(store.sessionEmail, selected.id)); } catch { /* Storage may be unavailable. */ }
        setPendingDecision(undefined);
      }
      setError(message || "The decision could not be confirmed. Refresh the request before retrying.");
    } finally {
      setBusy(false);
    }
  }

  const canDecide = store.mode === "live"
    && store.role === "TREASURY_ADMIN"
    && !!selected
    && selected.status === "PENDING"
    && selected.requesterEmail.trim().toLowerCase() !== store.sessionEmail?.trim().toLowerCase();
  const requesterIsSelf = !!selected && selected.requesterEmail.trim().toLowerCase() === store.sessionEmail?.trim().toLowerCase();

  return (
    <>
      <PageHeading title="Approvals" description="Review ordinary transfer requests before any funds move." />
      {store.mode === "demo" ? (
        <section className="panel">
          <Empty title="No persisted approval queue in demo mode">
            Demo transfers remain synthetic simulations and reset with the session. Switch to Local API to review real approval requests.
          </Empty>
        </section>
      ) : (
        <>
          <Notice>Pending requests do not reserve funds or create journal entries. Approval rechecks the accounts and balance before the transfer is posted.</Notice>
          {store.role !== "TREASURY_ADMIN" && <Notice>Your role can review requests, but only a Treasury Admin can decide them.</Notice>}
          {error && <Notice danger>{error}</Notice>}
          {queueStale && <Notice danger>The queue could not be refreshed. Listed requests may be stale; refresh the page before relying on them.</Notice>}
          <div className="approval-layout">
            <section className="panel approval-queue" aria-label="Transfer approval queue">
              <div className="toolbar">
                <label className="approval-filter">
                  Status
                  <select aria-label="Filter approval requests by status" value={status} onChange={(event) => { setStatus(event.target.value as StatusFilter); setPage(0); }}>
                    <option value="PENDING">Pending</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                    <option value="ALL">All requests</option>
                  </select>
                </label>
                <span className="toolbar-end">{totalElements} request{totalElements === 1 ? "" : "s"}</span>
              </div>
              {loading ? <p className="panel-note">Loading requests…</p> : items.length === 0 ? (
                <Empty title="No matching requests">Try another status or check again later.</Empty>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead><tr><th>Submitted</th><th>Requester</th><th>Amount</th><th>Status</th><th /></tr></thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.id} aria-selected={selectedId === item.id}>
                          <td className="date">{stamp(item.createdAt)}</td>
                          <td>{item.requesterEmail}</td>
                          <td className="number">{money(item.amount)}</td>
                          <td><span className="badge">{item.status}</span></td>
                          <td><button className="link plain" onClick={() => void selectRequest(item.id)}>{selectedId === item.id ? "Selected" : "Review"}</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="table-footer">
                <span>Page {totalPages ? page + 1 : 0} of {totalPages}</span>
                <div className="inline">
                  <button disabled={page <= 0 || loading} onClick={() => setPage((value) => Math.max(0, value - 1))}>Previous</button>
                  <button disabled={page + 1 >= totalPages || loading} onClick={() => setPage((value) => value + 1)}>Next</button>
                </div>
              </div>
            </section>

            <section className="panel approval-detail" aria-label="Selected transfer request">
              {!selected ? <Empty title="Select a request">Request details and available decisions appear here.</Empty> : (
                <>
                  <div className="section-heading"><h2>Request details</h2><span className="badge">{selected.status}</span></div>
                  <dl className="detail-list">
                    <dt>Requester</dt><dd>{selected.requesterEmail}</dd>
                    <dt>Submitted</dt><dd>{stamp(selected.createdAt)}</dd>
                    <dt>Source</dt><dd>{store.accounts.find((account) => account.id === selected.sourceAccountId)?.name || shortId(selected.sourceAccountId)}</dd>
                    <dt>Destination</dt><dd>{store.accounts.find((account) => account.id === selected.targetAccountId)?.name || shortId(selected.targetAccountId)}</dd>
                    <dt>Amount</dt><dd>{money(selected.amount)}</dd>
                    <dt>Description</dt><dd>{selected.description || "—"}</dd>
                    <dt>Reference</dt><dd className="mono wrap">{selected.idempotencyKey}</dd>
                    {selected.decisionActorEmail && <><dt>Decided by</dt><dd>{selected.decisionActorEmail}</dd></>}
                    {selected.decidedAt && <><dt>Decision time</dt><dd>{stamp(selected.decidedAt)}</dd></>}
                    {selected.decisionReason && <><dt>Decision reason</dt><dd>{selected.decisionReason}</dd></>}
                    {selected.completedTransferId && <><dt>Transfer</dt><dd><Link className="link" href={`/ledger?account=${selected.sourceAccountId}&transaction=${selected.completedTransferId}`}>{shortId(selected.completedTransferId)} · View journal</Link></dd></>}
                  </dl>
                  {requesterIsSelf && <Notice>You submitted this request, so you cannot approve or reject it.</Notice>}
                  {store.role === "TREASURY_ADMIN" && selected.status === "PENDING" && !requesterIsSelf && (
                    <div className="decision-form">
                      <label htmlFor="decision-reason">Decision reason</label>
                      <textarea id="decision-reason" aria-label="Decision reason" maxLength={255} value={reason} disabled={!!pendingDecision || busy} onChange={(event) => setReason(event.target.value)} placeholder="Record the review rationale" />
                      <small>{pendingDecision ? `Outcome unconfirmed. Retry the same ${pendingDecision.action} with the saved reason; the choice cannot be changed.` : `${reason.length}/255 characters · required for both decisions`}</small>
                      <div className="inline">
                        {(!pendingDecision || pendingDecision.action === "reject") && <button disabled={!canDecide || !reason.trim() || busy} onClick={() => void decide("reject")}>{busy ? "Saving…" : pendingDecision ? "Retry same rejection" : "Reject request"}</button>}
                        {(!pendingDecision || pendingDecision.action === "approve") && <button className="primary" disabled={!canDecide || !reason.trim() || busy} onClick={() => void decide("approve")}>{busy ? "Saving…" : pendingDecision ? "Retry same approval" : "Approve transfer"}</button>}
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}
