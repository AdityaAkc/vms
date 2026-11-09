"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { homeFor, useSession } from "@/lib/store/session";

export default function Home() {
  const session = useSession((s) => s.session);
  const router = useRouter();
  useEffect(() => {
    router.replace(homeFor(session));
  }, [router, session]);
  return null;
}
