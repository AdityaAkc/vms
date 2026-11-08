import type { Metadata } from "next";
import { StudentMembershipView } from "./student-membership-view";

export const metadata: Metadata = { title: "My membership" };

export default function Page() {
  return <StudentMembershipView />;
}
