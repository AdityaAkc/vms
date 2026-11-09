import type { Metadata } from "next";
import { StudentDashboardView } from "./student-dashboard-view";

export const metadata: Metadata = { title: "Home" };

export default function Page() {
  return <StudentDashboardView />;
}
