import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LedgerFlow · Personal wallet",
  description: "Explore simulated balances, wallet transfers and transaction activity.",
};

export default function WalletLayout({ children }: { children: React.ReactNode }) {
  return children;
}
