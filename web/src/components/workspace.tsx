"use client";
import Link from "next/link";
import { FlowMark } from "@/components/flow-mark";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Account,
  Entry,
  Transfer,
  TransferRequest,
  api,
  permissions,
  Role,
  User,
  cents,
  decimal,
  demoAccounts,
  demoEntries,
  demoTransfers,
} from "@/lib/domain";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Store = {
  mode: "demo" | "live";
  role: Role | null;
  sessionEmail: string | null;
  sessionUserId: string | null;
  permissions: ReturnType<typeof permissions>;
  accounts: Account[];
  entries: Entry[];
  transfers: Transfer[];
  loading: boolean;
  error: string;
  checked?: string;
  refreshSession: () => Promise<void>;
  refresh: () => Promise<void>;
  create: (
    data: Pick<Account, "name" | "type" | "openingBalance">,
  ) => Promise<void>;
  transfer: (
    data: Omit<Transfer, "id" | "status" | "createdAt">,
    deposit: boolean,
  ) => Promise<Transfer | TransferRequest>;
};
type SessionUser = User;
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
    audit: "M4 5h16M4 12h16M4 19h16M8 5v14",
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
  const router = useRouter();
  const [mode, setMode] = useState<"demo" | "live">("demo");
  const [accounts, setAccounts] = useState(demoAccounts);
  const [entries, setEntries] = useState<Entry[]>(demoEntries);
  const [transfers, setTransfers] = useState<Transfer[]>(demoTransfers);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checked, setChecked] = useState<string>();
  const [mobile, setMobile] = useState(false);
  const [pendingLiveMode, setPendingLiveMode] = useState(false);
  const [session, setSession] = useState<SessionUser | null>(null);
  const generation = useRef(0);
  const mobileToggle = useRef<HTMLButtonElement>(null);
  const mobileSidebar = useRef<HTMLElement>(null);
  const sessionGeneration = useRef(0);
  const staffRole = session?.role === "CUSTOMER" ? null : session?.role ?? null;
  const allowed = permissions(mode, staffRole);
  const navigation: [string, string][] = [
    ["accounts", "Accounts"],
    ["transfers", "Transfers"],
    ["approvals", "Approvals"],
    ["treasury", "Treasury"],
    ["ledger", "Ledger"],
    ["audit", "Audit trail"],
    ["system-status", "System status"],
  ];
  if (session?.role === "TREASURY_ADMIN") navigation.splice(6, 0, ["users", "Users"]);
  const closeMobileNavigation = useCallback(() => {
    setMobile(false);
    if (mobile) mobileToggle.current?.focus();
  }, [mobile]);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 801px)");
    function closeOnDesktop() {
      if (desktop.matches) setMobile(false);
    }
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);
  useEffect(() => {
    if (!mobile) return;
    const focusable = () => Array.from(
      mobileSidebar.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    );
    focusable()[0]?.focus();
    function containNavigationFocus(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMobileNavigation();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0];
      const last = items.at(-1);
      if (!first || !last) {
        event.preventDefault();
        return;
      }
      if (!mobileSidebar.current?.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", containNavigationFocus);
    return () => document.removeEventListener("keydown", containNavigationFocus);
  }, [closeMobileNavigation, mobile]);
  useEffect(() => {
    function expired() {
      setSession(null);
      router.replace("/auth/login");
      router.refresh();
    }
    window.addEventListener("ledgerflow-session-expired", expired);
    return () => window.removeEventListener("ledgerflow-session-expired", expired);
  }, [router]);
  const refreshSession = useCallback(async () => {
    const requestNumber = ++sessionGeneration.current;
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      if (requestNumber !== sessionGeneration.current) return;
      if (response.status === 401) {
        window.dispatchEvent(new Event("ledgerflow-session-expired"));
        return;
      }
      if (!response.ok) {
        setSession(null);
        return;
      }
      const user = (await response.json()) as SessionUser;
      if (requestNumber !== sessionGeneration.current) return;
      if (!user?.id || !user.email || !user.role) {
        setSession(null);
        return;
      }
      if (user.role === "CUSTOMER") {
        setSession(null);
        await fetch("/api/auth/logout", { method: "POST" });
        router.replace("/wallet");
        return;
      }
      setSession(user);
    } catch {
      // The backend's persisted role is authoritative. Drop cached privileges if it cannot be checked.
      if (requestNumber === sessionGeneration.current) setSession(null);
    }
  }, [router]);
  useEffect(() => {
    const timer = window.setTimeout(() => void refreshSession(), 0);
    return () => window.clearTimeout(timer);
  }, [pathname, refreshSession]);
  useEffect(() => {
    const onFocus = () => void refreshSession();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refreshSession();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshSession]);
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
    if (!allowed.create) throw new Error("Your role cannot create accounts.");
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
    if (!(deposit ? allowed.deposit : allowed.transfer)) throw new Error("Your role cannot perform this operation.");
    if (mode === "live") {
      setLoading(true);
      try {
        const result = await api<Transfer | TransferRequest>(
          deposit ? `accounts/${data.targetAccountId}/deposits` : "transfer-requests",
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
  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/auth/login");
    router.refresh();
  }
  return (
    <Context.Provider
      value={{
        mode,
        role: staffRole,
        sessionEmail: session?.email ?? null,
        sessionUserId: session?.id ?? null,
        permissions: allowed,
        accounts,
        entries,
        transfers,
        loading,
        error,
        checked,
        refreshSession,
        refresh,
        create,
        transfer,
      }}
    >
      <a className="skip" href="#main">
        Skip to content
      </a>
      <aside ref={mobileSidebar} className={`sidebar ${mobile ? "open" : ""}`}>
        <div className="brand">
          <strong className="operations-wordmark">
            <FlowMark /> LedgerFlow
          </strong>
          <small>OPERATIONS</small>
        </div>
        <nav id="main-navigation" aria-label="Main navigation">
          <span className="nav-group-label">Money movement</span>
          {navigation.map(([path, label]) => (
            <div key={path}>
            {path === "ledger" && <span className="nav-group-label">Records &amp; oversight</span>}
            <Link
              onClick={closeMobileNavigation}
              key={path}
              href={`/${path}`}
              aria-current={pathname === `/${path}` ? "page" : undefined}
            >
              <Icon name={path} />
              {label}
            </Link>
            </div>
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
              ref={mobileToggle}
              className="mobile-toggle"
              aria-label="Toggle navigation"
              aria-controls="main-navigation"
              aria-expanded={mobile}
              onClick={() => setMobile(!mobile)}
            >
              <Icon name="menu" />
            </button>
            <span className="muted">LedgerFlow Indonesia</span>
            <span className="muted">/</span>
            <strong>Operations</strong>
          </div>
          <div className="inline">
            <label className="mode-label">
              Data{" "}
              <Select
                items={[
                  { value: "demo", label: "Demo preview" },
                  { value: "live", label: "Local API" },
                ]}
                disabled={loading}
                value={mode}
                onValueChange={(value) => {
                  const nextMode = value as "demo" | "live";
                  if (nextMode === "live" && mode !== "live") {
                    setPendingLiveMode(true);
                    return;
                  }
                  void changeMode(nextMode);
                }}
              >
                <SelectTrigger className="mode-select" aria-label="Data source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="ledgerflow-select">
                  <SelectGroup>
                    <SelectItem value="demo">Demo preview</SelectItem>
                    <SelectItem value="live">Local API</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </label>
            <span className="badge">SANDBOX</span>
            {session && (
              <>
                <span className="badge">{session.role}</span>
                <button className="sign-out" onClick={() => void signOut()}>
                  Sign out
                </button>
                <span className="avatar" title={session.email}>
                  {session.email.slice(0, 2).toUpperCase()}
                </span>
              </>
            )}
          </div>
        </header>
        {mobile && (
          <button
            className="mobile-nav-backdrop"
            type="button"
            aria-label="Close navigation"
            onClick={closeMobileNavigation}
          />
        )}
        <main id="main" key={mode} className="content">
          <div className="mode-note">
            {mode === "demo"
              ? "DEMO DATA · Synthetic accounts. Changes stay in this session and reset on reload or mode switch."
              : "LOCAL API · Connected operations modify your development database. Actions follow the permissions of your signed-in role."}
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
        <AlertDialog
          open={pendingLiveMode}
          onOpenChange={(open) => setPendingLiveMode(open)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Connect to Local API?</AlertDialogTitle>
              <AlertDialogDescription>
                Ordinary transfers create approval requests; funds move only after
                an eligible administrator approves. Allocations and account
                creation write to your local development database.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Stay in demo</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setPendingLiveMode(false);
                  void changeMode("live");
                }}
              >
                Continue to Local API
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Context.Provider>
  );
}
