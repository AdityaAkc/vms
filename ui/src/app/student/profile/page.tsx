import type { Metadata } from "next";
import { StudentProfileView } from "./student-profile-view";

export const metadata: Metadata = { title: "Profile" };

export default function Page() {
  return <StudentProfileView />;
}
