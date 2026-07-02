import type { Metadata } from "next";
import { ClientAuthLayout } from "@/app/components/ClientAuthLayout";
import SignupForm from "@/app/components/SignupForm";

export const metadata: Metadata = {
  title: "Create your account - 7eats",
};

export default function SignupPage() {
  return (
    <ClientAuthLayout>
      <SignupForm />
    </ClientAuthLayout>
  );
}
