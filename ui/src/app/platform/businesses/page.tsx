import type { Metadata } from "next";
import { BusinessesView } from "./businesses-view";

export const metadata: Metadata = { title: "Businesses" };

export default function Page() {
  return <BusinessesView />;
}
