import type { Metadata } from "next";
import { PlansView } from "./plans-view";

export const metadata: Metadata = { title: "Plans & pricing" };

export default function PlansPage() {
  return <PlansView />;
}
