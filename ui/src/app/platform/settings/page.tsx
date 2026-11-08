import type { Metadata } from "next";
import { PlatformSettingsView } from "./platform-settings-view";

export const metadata: Metadata = { title: "Platform settings" };

export default function Page() {
  return <PlatformSettingsView />;
}
