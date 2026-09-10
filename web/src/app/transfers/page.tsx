import { Suspense } from "react";
import { PaymentPage } from "@/components/payment";
export default function Page() {
  return (
    <Suspense>
      <PaymentPage />
    </Suspense>
  );
}
