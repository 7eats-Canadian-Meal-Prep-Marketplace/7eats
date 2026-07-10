import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

/** Better Auth session lookup for middleware/proxy — single source of truth. */
export async function getRequestSession(req: NextRequest) {
  try {
    return await auth.api.getSession({ headers: req.headers });
  } catch {
    return null;
  }
}

export type RequestSession = NonNullable<
  Awaited<ReturnType<typeof getRequestSession>>
>;
