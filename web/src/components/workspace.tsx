"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import {
  Account,
  Entry,
  Transfer,
  api,
  cents,
  decimal,
  demoAccounts,
  demoEntries,
  demoTransfers,
} from "@/lib/domain";

type Store = {
  mode: "demo" | "live";
  accounts: Account[];
  entries: Entry[];
  transfers: Transfer[];
  loading: boolean;
  error: string;
  checked?: string;
  refresh: () => Promise<void>;
  create: (
    data: Pick<Account, "name" | "type" | "openingBalance">,
  ) => Promise<void>;
  transfer: (
    data: Omit<Transfer, "id" | "status" | "createdAt">,
    deposit: boolean,
  ) => Promise<Transfer>;
};
const Context = createContext<Store | null>(null);
export function useWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error("Workspace missing");
  return value;
}
export function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    accounts: "M3 10h18M5 10v9m5-9v9m4-9v9m5-9v9M3 21h18M2 7l10-5 10 5H2",
    transfers: "M3 7h17m-4-4 4 4-4 4M21 17H4m4-4-4 4 4 4",
    treasury: "M3 5h18v15H3zM3 9h18m-5 4h5v4h-5z",
    ledger: "M12 5v16M3 3l9 2 9-2v16l-9 2-9-2z",
    "system-status": "M3 3h18v7H3zM3 14h18v7H3zM6 6h1m-1 11h1",
    refresh: "M20 7a9 9 0 1 0 1 9M20 2v5h-5",
    plus: "M12 5v14M5 12h14",
    search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
    copy: "M8 8h13v13H8zM16 8V3H3v13h5",
    close: "m6 6 12 12M6 18 18 6",
    arrow: "M4 12h16m-6-6 6 6-6 6",
    menu: "M3 6h18M3 12h18M3 18h18",
  };
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.ledger} />
    </svg>
  );
}
export function Workspace({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mode, setMode] = useState<"demo" | "live">("demo");
  const [accounts, setAccounts] = useState(demoAccounts);
  const [entries, setEntries] = useState<Entry[]>(demoEntries);
  const [transfers, setTransfers] = useState<Transfer[]>(demoTransfers);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checked, setChecked] = useState<string>();
  const [mobile, setMobile] = useState(false);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    if (mode === "demo") {
      setChecked(new Date().toISOString());
      return;
    }
    const run = generation.current;
    setLoading(true);
    setError("");
    try {
      const data = await api<Account[]>("accounts");
      if (run === generation.current) {
        setAccounts(data);
        setChecked(new Date().toISOString());
      }
    } catch (e) {
      if (run === generation.current) setError((e as Error).message);
    } finally {
      if (run === generation.current) setLoading(false);
    }
  }, [mode]);
  async function changeMode(value: "demo" | "live") {
    const run = ++generation.current;
    setMode(value);
    setAccounts(value === "demo" ? demoAccounts : []);
    setEntries(value === "demo" ? demoEntries : []);
    setTransfers(value === "demo" ? demoTransfers : []);
    setError("");
    setChecked(undefined);
    if (value === "live") {
      setLoading(true);
      try {
        const data = await api<Account[]>("accounts");
        if (run === generation.current) {
          setAccounts(data);
          setChecked(new Date().toISOString());
        }
      } catch (e) {
        if (run === generation.current) setError((e as Error).message);
      } finally {
        if (run === generation.current) setLoading(false);
      }
    }
  }
  async function create(
    data: Pick<Account, "name" | "type" | "openingBalance">,
  ) {
    if (mode === "live") {
      setLoading(true);
      try {
        await api("accounts", data);
        await refresh();
      } finally {
        setLoading(false);
      }
    } else
      setAccounts((a) => [
        ...a,
        {
          ...data,
          id: crypto.randomUUID(),
          currentBalance: data.openingBalance,
          createdAt: new Date().toISOString(),
        },
      ]);
  }
  async function transfer(
    data: Omit<Transfer, "id" | "status" | "createdAt">,
    deposit: boolean,
  ) {
    if (mode === "live") {
      setLoading(true);
      try {
        const result = await api<Transfer>(
          deposit ? `accounts/${data.targetAccountId}/deposits` : "transfers",
          deposit
            ? {
                amount: data.amount,
                description: data.description,
                idempotencyKey: data.idempotencyKey,
              }
            : data,
        );
        await refresh();
        return result;
      } finally {
        setLoading(false);
      }
    }
    const previous = transfers.find(
      (t) => t.idempotencyKey === data.idempotencyKey,
    );
    if (previous) return previous;
    const amount = cents(data.amount);
    const source = accounts.find((a) => a.id === data.sourceAccountId);
    if (!source || amount <= BigInt(0) || cents(source.currentBalance) < amount)
      throw new Error("Insufficient balance.");
    if (
      data.sourceAccountId === data.targetAccountId ||
      !accounts.some((a) => a.id === data.targetAccountId)
    )
      throw new Error("Choose a different destination account.");
    const result = {
      ...data,
      id: crypto.randomUUID(),
      status: "COMPLETED",
      createdAt: new Date().toISOString(),
    };
    setAccounts((list) =>
      list.map((a) =>
        a.id === data.sourceAccountId
          ? { ...a, currentBalance: decimal(cents(a.currentBalance) - amount) }
          : a.id === data.targetAccountId
            ? {
                ...a,
                currentBalance: decimal(cents(a.currentBalance) + amount),
              }
            : a,
      ),
    );
    setTransfers((list) => [result, ...list]);
    setEntries((list) => [
      ...(["DEBIT", "CREDIT"] as const).map((direction) => ({
        id: crypto.randomUUID(),
        transferId: result.id,
        accountId:
          direction === "DEBIT" ? data.sourceAccountId : data.targetAccountId,
        direction,
        amount: data.amount,
        createdAt: result.createdAt,
      })),
      ...list,
    ]);
    return result;
  }
  return (
    <Context.Provider
      value={{
        mode,
        accounts,
        entries,
        transfers,
        loading,
        error,
        checked,
        refresh,
        create,
        transfer,
      }}
    >
      <a className="skip" href="#main">
        Skip to content
      </a>
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <div className="brand">
          <strong>
            LedgerFlow<span className="brand-mark">╱</span>
          </strong>
          <small>OPERATIONS</small>
        </div>
        <nav aria-label="Main navigation">
          {[
            ["accounts", "Accounts"],
            ["transfers", "Transfers"],
            ["treasury", "Treasury"],
            ["ledger", "Ledger"],
            ["system-status", "System status"],
          ].map(([path, label]) => (
            <Link
              onClick={() => setMobile(false)}
              key={path}
              href={`/${path}`}
              aria-current={pathname === `/${path}` ? "page" : undefined}
            >
              <Icon name={path} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <small>WORKSPACE / LOCAL</small>
          <p>
            <span className="dot" /> SANDBOX
          </p>
          <small>Ledger operations console</small>
        </div>
      </aside>
      <div className="app">
        <header className="topbar">
          <div className="inline">
            <button
              className="mobile-toggle"
              aria-label="Toggle navigation"
              onClick={() => setMobile(!mobile)}
            >
              <Icon name="menu" />
            </button>
            <span className="muted">LedgerFlow Indonesia</span>
            <span className="muted">/</span>
            <strong>Treasury Core</strong>
          </div>
          <div className="inline">
            <label className="mode-label">
              Data{" "}
              <select
                aria-label="Data source"
                disabled={loading}
                value={mode}
                onChange={(e) =>
                  void changeMode(e.target.value as "demo" | "live")
                }
              >
                <option value="demo">Demo preview</option>
                <option value="live">Local API</option>
              </select>
            </label>
            <span className="badge">SANDBOX</span>
            <span className="avatar">OP</span>
          </div>
        </header>
        <main id="main" key={mode} className="content">
          <div className="mode-note">
            {mode === "demo"
              ? "DEMO DATA · Synthetic accounts. Changes stay in this session and reset on reload or mode switch."
              : "LOCAL API · Connected operations modify your development database. Authentication is not configured."}
          </div>
          {children}
        </main>
        <footer className="global-footer">
          <span>LedgerFlow / Operations workspace</span>
          <span>
            {mode === "demo" ? "SYNTHETIC DATA" : "LOCAL DEVELOPMENT"}{" "}
            <span className="dot" /> IDR · Asia/Jakarta
          </span>
        </footer>
      </div>
    </Context.Provider>
  );
}
