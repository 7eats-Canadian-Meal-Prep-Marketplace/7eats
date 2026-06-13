import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ClientAuthLayout } from "@/app/components/ClientAuthLayout";
import ResetPasswordForm from "@/app/components/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Reset password — 7eats",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  if (error === "INVALID_TOKEN" || !token) {
    redirect("/app-auth/forgot-password?error=expired");
  }

  return (
    <ClientAuthLayout>
      <ResetPasswordForm token={token} audience="client" />
    </ClientAuthLayout>
  );
}
