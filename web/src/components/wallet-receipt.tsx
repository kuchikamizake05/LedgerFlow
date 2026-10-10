"use client";

import { useEffect, useState, type RefObject } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Check, Copy, Printer, X } from "lucide-react";
import { FlowMark } from "@/components/flow-mark";
import { money } from "@/lib/domain";
import { receiptTime, receiptTitle, type WalletReceipt } from "@/lib/wallet-receipt";

export function WalletReceiptDialog({ id, close, opener }: { id: string; close: () => void; opener: RefObject<HTMLElement | null> }) {
  const [receipt, setReceipt] = useState<WalletReceipt | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [copyNotice, setCopyNotice] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/wallet/transactions/${encodeURIComponent(id)}`, {cache: "no-store", signal: controller.signal})
      .then(async response => {
        const data = await response.json();
        if (response.status === 401) window.dispatchEvent(new Event("ledgerflow-wallet-session-expired"));
        if (!response.ok) throw new Error(data.message || "Transaction details could not be loaded.");
        if (data.id !== id) throw new Error("Transaction reference does not match.");
        if (!controller.signal.aborted) setReceipt(data);
      }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Transaction details could not be loaded."); });
    return () => controller.abort();
  }, [id, attempt]);
  async function copy() {
    try { await navigator.clipboard.writeText(id); setCopyNotice("Reference copied."); }
    catch { setCopyNotice("Unable to copy. Select the full reference below instead."); }
  }
  return <Dialog.Root open onOpenChange={open => { if (!open) close(); }}>
    <Dialog.Portal><Dialog.Backdrop className="wallet-receipt-backdrop" />
      <Dialog.Popup className="wallet-receipt-dialog" finalFocus={opener}>
        <div className="wallet-receipt-toolbar"><span><FlowMark /> LedgerFlow <b>SIMULATION</b></span><Dialog.Close className="wallet-receipt-close" aria-label="Close transaction details"><X size={20} /></Dialog.Close></div>
        <Dialog.Title className="wallet-receipt-heading">Transaction details</Dialog.Title>
        <Dialog.Description className="wallet-receipt-description">Your personal record of simulated funds.</Dialog.Description>
        {!receipt ? error ? <div className="wallet-receipt-error"><p role="alert">{error}</p><button type="button" onClick={() => { setError(""); setAttempt(current => current + 1); }}>Retry details</button></div> : <p className="wallet-receipt-loading" role="status">Loading transaction…</p> : <div className="wallet-receipt-body">
          <div className="wallet-receipt-hero"><span className="wallet-receipt-symbol" aria-hidden="true"><FlowMark /></span><p>{receiptTitle(receipt)}</p><strong>{receipt.direction === "CREDIT" ? "+" : "−"}{money(receipt.amount)}</strong><span className={`wallet-receipt-status ${receipt.status === "REVERSED" ? "reversed" : ""}`}><Check size={14} aria-hidden="true" />{receipt.status === "REVERSED" ? "Reversed" : "Completed"}</span></div>
          {receipt.status === "REVERSED" && <p className="wallet-receipt-note">This transaction was reversed. A separate correction records the movement back.</p>}
          {receipt.reversalOf && <p className="wallet-receipt-note">This correction reverses the transaction referenced below.</p>}
          <dl className="wallet-receipt-fields"><div><dt>From</dt><dd>{receipt.source.name}<code>{receipt.source.id}</code></dd></div><div><dt>To</dt><dd>{receipt.target.name}<code>{receipt.target.id}</code></dd></div><div><dt>Date & time</dt><dd>{receiptTime(receipt.createdAt)}</dd></div><div><dt>Transaction reference</dt><dd><code>{receipt.id}</code></dd></div>{receipt.description && <div><dt>Description</dt><dd>{receipt.description}</dd></div>}{receipt.reversalOf && <div><dt>Original transaction</dt><dd><code>{receipt.reversalOf}</code></dd></div>}</dl>
          <p className="wallet-receipt-disclaimer">SIMULATED FUNDS · No real payment was processed. This is a simulation record.</p>
          <div className="wallet-receipt-actions"><button type="button" onClick={copy}><Copy size={16} />Copy reference</button><button className="print" type="button" onClick={() => window.print()}><Printer size={16} />Print / save PDF</button></div>
          <p className="wallet-receipt-print-hint">Choose &quot;Save as PDF&quot; in your browser’s print window.</p>
          {copyNotice && <p className="wallet-receipt-copy-notice" role="status">{copyNotice}</p>}
        </div>}
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>;
}
