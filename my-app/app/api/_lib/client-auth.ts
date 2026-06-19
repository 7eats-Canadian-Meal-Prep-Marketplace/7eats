import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function getClientSession(headers: Headers) {
  return auth.api.getSession({ headers });
}

export const unauthorized = () =>
  NextResponse.json({ error: "Not authenticated." }, { status: 401 });

export const notFound = (entity: string) =>
  NextResponse.json({ error: `${entity} not found.` }, { status: 404 });

export const forbidden = () =>
  NextResponse.json({ error: "Access denied." }, { status: 403 });
