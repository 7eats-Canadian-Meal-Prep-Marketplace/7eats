import type { Metadata } from "next";
import { ClientAuthLayout } from "@/app/components/ClientAuthLayout";
import ForgotPasswordForm from "@/app/components/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Forgot password - 7eats",
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <ClientAuthLayout>
      <ForgotPasswordForm expiredLink={error === "expired"} audience="client" />
    </ClientAuthLayout>
  );
}
