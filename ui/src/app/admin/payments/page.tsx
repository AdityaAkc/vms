import { Suspense } from "react";
import type { Metadata } from "next";
import { PaymentsView } from "./payments-view";

export const metadata: Metadata = { title: "Payments" };

export default function PaymentsPage() {
  return (
    <Suspense>
      <PaymentsView />
    </Suspense>
  );
}
