"use client";

import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { initDb, useDb } from "@/lib/store/db";
import { useSession } from "@/lib/store/session";

/**
 * Client root: hydrates the mock database + demo session from localStorage
 * before rendering any data-driven screen.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  const ready = useDb((s) => s.ready);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    void initDb();
    void Promise.resolve(useSession.persist.rehydrate()).then(() => setSessionReady(true));
  }, []);

  return (
    <TooltipProvider delayDuration={200}>
      {ready && sessionReady ? children : <BootScreen />}
      <Toaster position="top-right" theme="light" richColors={false} closeButton />
    </TooltipProvider>
  );
}

function BootScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <div className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" />
        <p className="text-sm">Loading workspace…</p>
      </div>
    </div>
  );
}
