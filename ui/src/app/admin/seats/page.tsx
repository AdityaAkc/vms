import { Suspense } from "react";
import type { Metadata } from "next";
import { SeatsView } from "./seats-view";

export const metadata: Metadata = { title: "Seats" };

export default function SeatsPage() {
  return (
    <Suspense>
      <SeatsView />
    </Suspense>
  );
}
