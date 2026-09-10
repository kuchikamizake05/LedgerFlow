import { Suspense } from "react";
import { LedgerPage } from "@/components/ledger";
export default function Page() {
  return (
    <Suspense>
      <LedgerPage />
    </Suspense>
  );
}
