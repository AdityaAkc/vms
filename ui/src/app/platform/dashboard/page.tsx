import type { Metadata } from "next";
import { PlatformDashboardView } from "./platform-dashboard-view";

export const metadata: Metadata = { title: "Platform overview" };

export default function Page() {
  return <PlatformDashboardView />;
}
