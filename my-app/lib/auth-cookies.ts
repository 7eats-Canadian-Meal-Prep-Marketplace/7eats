import { cookies } from "next/headers";

export async function forwardAuthCookies(response: Response): Promise<void> {
  const jar = await cookies();
  const rawHeaders = response.headers as Headers & {
    getSetCookie?: () => string[];
  };
  const setCookies: string[] = rawHeaders.getSetCookie?.() ?? [];

  for (const raw of setCookies) {
    const parts = raw.split(";").map((s) => s.trim());
    const eqIdx = parts[0].indexOf("=");
    if (eqIdx === -1) continue;
    const name = parts[0].slice(0, eqIdx);
    const value = parts[0].slice(eqIdx + 1);
    const opts: {
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: "lax" | "strict" | "none";
      maxAge?: number;
      path?: string;
    } = {};
    for (const part of parts.slice(1)) {
      const lower = part.toLowerCase();
      if (lower === "httponly") opts.httpOnly = true;
      else if (lower === "secure") opts.secure = true;
      else if (lower.startsWith("samesite="))
        opts.sameSite = part.slice(9).toLowerCase() as
          | "lax"
          | "strict"
          | "none";
      else if (lower.startsWith("max-age="))
        opts.maxAge = Number(part.slice(8));
      else if (lower.startsWith("path=")) opts.path = part.slice(5);
    }
    if (opts.maxAge === 0) {
      jar.delete(name);
    } else {
      jar.set(name, value, opts);
    }
  }
}
