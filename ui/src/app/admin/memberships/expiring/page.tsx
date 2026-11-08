import type { Metadata } from "next";
import { ExpiringView } from "./expiring-view";

export const metadata: Metadata = { title: "Expiring memberships" };

export default function ExpiringPage() {
  return <ExpiringView />;
}
