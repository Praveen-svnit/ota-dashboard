"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";

interface SessionUser { id: string; username: string; name: string; role: string; ota: string | null; }

interface SidebarProps {
  lastRefreshed: Date | null;
}


export default function Sidebar({ lastRefreshed }: SidebarProps) {
  const pathname  = usePathname();
  const router    = useRouter();
  const [collapsed,  setCollapsed]  = useState(false);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.ok ? r.json() : null).then((d) => d && setSessionUser(d.user));
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }
