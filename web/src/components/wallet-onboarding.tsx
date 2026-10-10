"use client";

import { useState, useSyncExternalStore } from "react";
import { ArrowRight, Check, ChevronDown } from "lucide-react";
import type { WalletProgress } from "@/lib/wallet-receipt";

export function WalletOnboarding({ accountId, progress, error, frozen, retry }: {
  accountId: string; progress: WalletProgress | null; error: string; frozen: boolean; retry: () => void;
}) {
  const [override, setOverride] = useState<boolean | null>(null);
  const savedHidden = useSyncExternalStore(
    callback => { window.addEventListener("storage", callback); return () => window.removeEventListener("storage", callback); },
    () => { try { return localStorage.getItem(`ledgerflow-wallet-guide:${accountId}`) === "hidden"; } catch { return false; } },
    () => false,
  );
  function hide(value: boolean) {
    setOverride(value);
    try { localStorage.setItem(`ledgerflow-wallet-guide:${accountId}`, value ? "hidden" : "visible"); } catch { /* Preference is optional. */ }
  }
  if (override ?? savedHidden) return <button className="wallet-guide-reopen" onClick={() => hide(false)} type="button">Show getting started guide</button>;
  const count = 1 + Number(progress?.funded ?? false) + Number(progress?.sent ?? false);
  const steps = [
    { title: "Your wallet is ready", description: "New wallets start at zero. All funds here are simulated.", done: true, href: "" },
    { title: "Add simulated funds", description: "Try a top up to explore how your balance changes.", done: progress?.funded ?? false, href: "#wallet-topup" },
    { title: "Make your first transfer", description: "Use another wallet ID and confirm the recipient before sending.", done: progress?.sent ?? false, href: "#wallet-send" },
  ];
  return <section className="wallet-guide" aria-label="Getting started">
    <details open={Boolean(error) || !progress || count < 3}>
      <summary><span><strong>{count === 3 ? "You have made your first moves" : "Start with three small steps"}</strong><small>{progress ? `${count}/3 completed` : "Checking your progress…"}</small></span><ChevronDown size={18} aria-hidden="true" /></summary>
      {error ? <div className="wallet-guide-error"><p role="alert">Progress could not be loaded.</p><button type="button" onClick={retry}>Try again</button></div> : !progress ? <p className="wallet-guide-note">Loading your saved activity…</p> : <>
        <div className="wallet-guide-track" aria-hidden="true"><span style={{ width: `${count / 3 * 100}%` }} /></div>
        <ol>{steps.map((step, index) => <li key={step.title}><span className={step.done ? "done" : ""} aria-hidden="true">{step.done ? <Check size={15} /> : index + 1}</span><div><strong>{step.title}{step.done && <span className="sr-only"> — completed</span>}</strong><p>{step.description}</p></div>{!step.done && !frozen && <a href={step.href} aria-label={`Start: ${step.title}`}><ArrowRight size={18} /></a>}</li>)}</ol>
        {frozen && <p className="wallet-guide-note">Your wallet is frozen. You can continue these steps when it is unfrozen.</p>}
      </>}
    </details>
    <button className="wallet-guide-dismiss" type="button" onClick={() => hide(true)}>Hide guide</button>
  </section>;
}
