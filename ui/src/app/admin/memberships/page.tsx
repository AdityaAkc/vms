import { Suspense } from "react";
import type { Metadata } from "next";
import { MembershipsView } from "./memberships-view";

export const metadata: Metadata = { title: "Memberships" };

export default function MembershipsPage() {
  return (
    <Suspense>
      <MembershipsView />
    </Suspense>
  );
}
