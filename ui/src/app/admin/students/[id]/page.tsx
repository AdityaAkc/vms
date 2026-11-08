import { Suspense } from "react";
import type { Metadata } from "next";
import { StudentDetailView } from "./student-detail-view";

export const metadata: Metadata = { title: "Student profile" };

export default function StudentDetailPage() {
  return (
    <Suspense>
      <StudentDetailView />
    </Suspense>
  );
}
