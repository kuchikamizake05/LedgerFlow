export type WalletProgress = { funded: boolean; sent: boolean };
export type WalletReceipt = {
  id: string; kind: "TOPUP" | "TRANSFER" | "REVERSAL"; direction: "DEBIT" | "CREDIT";
  amount: string; status: "COMPLETED" | "REVERSED"; createdAt: string;
  source: {id: string; name: string}; target: {id: string; name: string};
  description: string | null; reversalOf: string | null;
};
export function receiptTitle(value: Pick<WalletReceipt, "kind" | "direction">) {
  if (value.kind === "REVERSAL") return "Transaction correction";
  if (value.kind === "TOPUP") return "Simulated top up";
  return value.direction === "DEBIT" ? "Money sent" : "Money received";
}
export function receiptTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleString("en-GB", {
    timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "medium",
  }) + " WIB";
}
