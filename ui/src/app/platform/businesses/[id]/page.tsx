import { Suspense } from "react";
import type { Metadata } from "next";
import { BusinessDetailView } from "./business-detail-view";

export const metadata: Metadata = { title: "Business" };

export default function Page() {
  return (
    <Suspense>
      <BusinessDetailView />
    </Suspense>
  );
}
