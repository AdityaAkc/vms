import type { Metadata } from "next";
import { StudentPaymentsView } from "./student-payments-view";

export const metadata: Metadata = { title: "Payments" };

export default function Page() {
  return <StudentPaymentsView />;
}
