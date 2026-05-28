"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export default function LogoutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleLogout = () => {
    startTransition(async () => {
      const res = await fetch("/api/auth/sign-out", { method: "POST" });
      const data = await res.json();
      router.push(data.redirect ?? "/business-auth/login");
    });
  };

  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      disabled={isPending}
      onClick={handleLogout}
    >
      {isPending ? "Signing out…" : "Log out"}
    </button>
  );
}
