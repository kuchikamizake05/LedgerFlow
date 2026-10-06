export type Account = {
  id: string;
  name: string;
  type: "BANK" | "CASH" | "EWALLET";
  openingBalance: string;
  currentBalance: string;
  createdAt: string;
};
export type Entry = {
  id: string;
  transferId: string;
  accountId: string;
  direction: "DEBIT" | "CREDIT";
  amount: string;
  createdAt: string;
};
export type PageResponse<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
};
export type Transfer = {
  id: string;
  sourceAccountId: string;
  targetAccountId: string;
  amount: string;
  status: string;
  idempotencyKey: string;
  description: string;
  createdAt: string;
};
export const TREASURY = "00000000-0000-0000-0000-000000000001";
export function cents(value: string): bigint {
  if (!/^\d+(\.\d{1,2})?$/.test(value))
    throw new Error(
      "Enter a non-negative amount with at most two decimal places.",
    );
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
}
export function decimal(value: bigint) {
  return `${value / BigInt(100)}.${(value % BigInt(100)).toString().padStart(2, "0")}`;
}
export function money(value: string | bigint) {
  const n = typeof value === "bigint" ? value : value.startsWith("-") ? -cents(value.slice(1)) : cents(value);
  const positive = n < BigInt(0) ? -n : n;
  return `${n < BigInt(0) ? "−" : ""}Rp ${(positive / BigInt(100)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${(positive % BigInt(100)).toString().padStart(2, "0")}`;
}
export function stamp(value?: string) {
  return value
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Jakarta",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(new Date(value)) + " WIB"
    : "Not checked";
}
export const shortId = (id: string) => `${id.slice(0, 8)}…${id.slice(-4)}`;
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}
const names: [string, Account["type"], string][] = [
  ["BCA Corporate Primary Operating Vault", "BANK", "2450000000"],
  ["Mandiri Operational Settlement Escrow", "BANK", "1180500000"],
  ["GoPay Merchant Corporate Node", "EWALLET", "1120000000"],
  ["Petty Cash Jakarta HQ Reserve", "CASH", "75450000"],
  ["CIMB Niaga Payroll Master", "BANK", "480000000"],
  ["OVO Aggregator Liquidity Buffer", "EWALLET", "320800000"],
  ["BNI International Clearing Ledger", "BANK", "215500000"],
  ["Dana Payout Disbursal Channel", "EWALLET", "134500000"],
  ["Petty Cash Surabaya Field Node", "CASH", "18000000"],
  ["Bank Danamon Tax Reserve Account", "BANK", "185000000"],
  ["ShopeePay Merchant Float Account", "EWALLET", "0"],
];
export const demoAccounts: Account[] = [
  ...names.map(([name, type, balance], i) => ({
    id: `10000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    name,
    type,
    openingBalance: balance,
    currentBalance: balance,
    createdAt: `2026-08-${String(i + 10).padStart(2, "0")}T02:30:00Z`,
  })),
  {
    id: TREASURY,
    name: "System Treasury",
    type: "BANK",
    openingBalance: "14500000000",
    currentBalance: "14500000000",
    createdAt: "2026-08-01T00:00:00Z",
  },
];
export const demoTransfers: Transfer[] = demoAccounts
  .slice(0, 6)
  .map((a, i) => ({
    id: `20000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    sourceAccountId: TREASURY,
    targetAccountId: a.id,
    amount: "5000000",
    status: "COMPLETED",
    idempotencyKey: `demo-allocation-${i + 1}`,
    description: "Sandbox operating allocation",
    createdAt: `2026-09-10T0${i + 1}:15:00Z`,
  }));
export const demoEntries: Entry[] = demoTransfers.flatMap((t, i) =>
  (["DEBIT", "CREDIT"] as const).map((direction, j) => ({
    id: `30000000-0000-4000-8000-${String(i * 2 + j + 1).padStart(12, "0")}`,
    transferId: t.id,
    accountId: direction === "DEBIT" ? t.sourceAccountId : t.targetAccountId,
    direction,
    amount: t.amount,
    createdAt: t.createdAt,
  })),
);
// Make synthetic opening balances reconcile with the seeded allocations.
for (const account of demoAccounts) {
  const delta = demoEntries
    .filter((e) => e.accountId === account.id)
    .reduce(
      (n, e) =>
        n + (e.direction === "CREDIT" ? cents(e.amount) : -cents(e.amount)),
      BigInt(0),
    );
  account.openingBalance = decimal(cents(account.currentBalance) - delta);
}
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/backend/${path}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (response.status === 401 && typeof window !== "undefined") {
    window.dispatchEvent(new Event("ledgerflow-session-expired"));
  }
  const result = await response.json();
  if (!response.ok)
    throw new ApiError(
      result.message || "Request failed. Check the API and try again.",
      response.status,
    );
  return result as T;
}

export type Role = "AUDITOR" | "OPERATOR" | "TREASURY_ADMIN";
export function permissions(mode: "demo" | "live", role: Role | null) {
  const demo = mode === "demo";
  return {
    create: demo || role === "TREASURY_ADMIN",
    transfer: demo || role === "OPERATOR" || role === "TREASURY_ADMIN",
    deposit: demo || role === "TREASURY_ADMIN",
  };
}
export type Reconciliation = {
  checkedAt: string;
  status: "BALANCED" | "MISMATCH";
  accountCount: number;
  mismatchedAccountCount: number;
  unbalancedTransferCount: number;
  accounts: { accountId: string; openingBalance: string; currentBalance: string; expectedBalance: string; difference: string; status: "BALANCED" | "MISMATCH" }[];
  unbalancedTransfers: { transferId: string; debitTotal: string; creditTotal: string; difference: string; entryCount: number }[];
};
