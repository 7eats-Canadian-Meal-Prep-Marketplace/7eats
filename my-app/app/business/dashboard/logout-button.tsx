"use client";

import { useTransition } from "react";
import { logout } from "@/app/business-auth/login/actions";

export default function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      disabled={isPending}
      onClick={() => startTransition(() => logout())}
    >
      {isPending ? "Signing out…" : "Log out"}
    </button>
  );
}
