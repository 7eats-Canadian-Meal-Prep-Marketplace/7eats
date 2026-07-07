import { redirect } from "next/navigation";

/** Bare domain hits `/app` — the consumer landing lives there. */
export default function RootPage() {
  redirect("/app");
}
