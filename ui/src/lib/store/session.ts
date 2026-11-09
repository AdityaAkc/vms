"use client";

/**
 * Demo session. Holds which role/tenant/student the demo is viewing as.
 * Real authentication (owner login exists in the backend at
 * POST /api/auth/login) will replace this; until then the role switcher
 * writes here. This is NOT a security boundary.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { APP_CONFIG } from "@/config/app";
import type { DemoSession } from "../types";

interface SessionState {
  session: DemoSession | null;
  signIn: (s: DemoSession) => void;
  signOut: () => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      session: null,
      signIn: (session) => set({ session }),
      signOut: () => set({ session: null }),
    }),
    {
      name: APP_CONFIG.sessionKey,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({ session: s.session }),
    },
  ),
);

export function homeFor(session: DemoSession | null): string {
  if (!session) return "/login";
  if (session.role === "platform") return "/platform/dashboard";
  if (session.role === "owner") return "/admin/dashboard";
  return "/student/dashboard";
}
